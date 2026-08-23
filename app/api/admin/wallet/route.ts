import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { KWD_EXCHANGE_RATE } from '@/lib/pricing-data';

export const dynamic = 'force-dynamic';

const ACCOUNT_STATUS_URL = 'https://www.runninghub.cn/uc/openapi/accountStatus';

interface CloudEngineAccountStatus {
  remainMoney: string;
  remainCoins: string;
  currentTaskCounts: string;
  currency: string;
  apiType: string;
}

/**
 * Fetch live account status directly from official cloud engine OpenAPI
 */
async function fetchLiveCloudStatus(apiKey: string): Promise<CloudEngineAccountStatus | null> {
  if (!apiKey) return null;
  try {
    const res = await fetch(ACCOUNT_STATUS_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ apikey: apiKey }),
      cache: 'no-store',
    });

    if (!res.ok) return null;
    const json = await res.json();
    if (json.code === 0 && json.data) {
      return json.data;
    }
    return null;
  } catch (err) {
    console.error('[fetchLiveCloudStatus error]', err);
    return null;
  }
}

/**
 * GET /api/admin/wallet
 * Returns live Master AI Studio Wallet balance, real-time Boutiqaat AI Studio Spend,
 * online & registered user counts, and recent generations.
 */
export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Super Admin access required' }, { status: 403 });
  }

  const enterpriseKey = process.env.RUNNINGHUB_API_KEY_ENTERPRISE || '';
  const consumerKey = process.env.RUNNINGHUB_API_KEY_CONSUMER || '';

  try {
    // 1. Fetch Real Live Balance directly from Cloud AI Engine API
    const [liveEnterprise, liveConsumer, usersRes, recentTasksRes] = await Promise.all([
      fetchLiveCloudStatus(enterpriseKey),
      fetchLiveCloudStatus(consumerKey),
      supabaseAdmin.from('users').select('id, name, email, role, avatar_url, created_at, last_login_at'),
      supabaseAdmin.from('tasks')
        .select('id, app_name, status, created_at, outputs, users(name, email)')
        .eq('status', 'SUCCESS')
        .order('created_at', { ascending: false })
        .limit(6),
    ]);

    const activeStatus = liveEnterprise || liveConsumer || {
      remainMoney: '0.000',
      remainCoins: '0',
      currentTaskCounts: '0',
      currency: 'USD',
      apiType: 'SHARED',
    };

    const liveRemainMoneyUsd = parseFloat(activeStatus.remainMoney || '0');
    const liveRemainCoins = parseInt(activeStatus.remainCoins || '0');
    const cloudTasksInFlight = parseInt(activeStatus.currentTaskCounts || '0');

    // 2. Fetch all recorded tasks with billing receipts from Supabase for live spend
    const { data: tasks } = await supabaseAdmin
      .from('tasks')
      .select('id, user_id, status, created_at, node_info_list, api_key_type')
      .not('runninghub_task_id', 'is', null);

    let actualSpendUsd = 0;
    let actualCoinsUsed = 0;
    let totalPaidTasks = 0;
    let enterpriseSpendUsd = 0;
    let consumerCoinsUsed = 0;

    const dailySpendMap: Record<string, number> = {};
    const activeUserIds24h = new Set<string>();
    const oneDayAgo = new Date(Date.now() - 24 * 3600000).toISOString();

    (tasks || []).forEach(t => {
      const nodeInfoList = t.node_info_list || [];
      const usageNode = nodeInfoList.find((n: any) => n.nodeId === 'USAGE' && n.fieldName === 'usage');

      if (t.created_at && t.created_at >= oneDayAgo && t.user_id) {
        activeUserIds24h.add(t.user_id);
      }

      if (usageNode?.fieldValue) {
        try {
          const usage = JSON.parse(usageNode.fieldValue);
          const money = usage?.consumeMoney ? parseFloat(usage.consumeMoney) : 0;
          const thirdParty = usage?.thirdPartyConsumeMoney ? parseFloat(usage.thirdPartyConsumeMoney) : 0;
          const coins = usage?.consumeCoins ? parseInt(usage.consumeCoins) : 0;
          const taskCost = money || thirdParty;

          if (taskCost > 0 || coins > 0) {
            actualSpendUsd += taskCost;
            actualCoinsUsed += coins;
            totalPaidTasks++;

            if (t.api_key_type === 'enterprise') {
              enterpriseSpendUsd += taskCost;
            } else {
              consumerCoinsUsed += coins;
            }

            const dayKey = (t.created_at || '').slice(0, 10);
            if (dayKey) {
              dailySpendMap[dayKey] = (dailySpendMap[dayKey] || 0) + taskCost;
            }
          }
        } catch {}
      }
    });

    const activeDays = Math.max(1, Object.keys(dailySpendMap).length);
    const avgDailyBurnUsd = actualSpendUsd / activeDays;
    const estimatedRunwayDays = avgDailyBurnUsd > 0
      ? Math.round((liveRemainMoneyUsd / avgDailyBurnUsd) * 10) / 10
      : 999;

    const healthStatus: 'healthy' | 'warning' | 'critical' =
      liveRemainMoneyUsd <= 2.0 ? 'critical' :
      liveRemainMoneyUsd <= 10.0 ? 'warning' : 'healthy';

    const registeredUsers = usersRes.data || [];
    const totalUsersCount = registeredUsers.length;
    // Count online/active: users with task activity in 24h + recent logins
    const onlineCount = Math.max(1, activeUserIds24h.size);

    return NextResponse.json({
      mainStudioWallet: {
        remainMoneyUsd: liveRemainMoneyUsd,
        remainMoneyKwd: Number((liveRemainMoneyUsd / KWD_EXCHANGE_RATE).toFixed(3)),
        remainCoins: liveRemainCoins,
        currentTaskCounts: cloudTasksInFlight,
        currency: activeStatus.currency || 'USD',
        apiType: activeStatus.apiType || 'SHARED',
        healthStatus,
        lastSyncedAt: new Date().toISOString(),
      },
      studioSpend: {
        actualSpendUsd: Number(actualSpendUsd.toFixed(3)),
        actualSpendKwd: Number((actualSpendUsd / KWD_EXCHANGE_RATE).toFixed(3)),
        actualCoinsUsed,
        totalPaidTasks,
        enterpriseSpendUsd: Number(enterpriseSpendUsd.toFixed(3)),
        consumerCoinsUsed,
        avgDailyBurnUsd: Number(avgDailyBurnUsd.toFixed(2)),
        estimatedRunwayDays,
        exchangeRate: KWD_EXCHANGE_RATE,
      },
      usersOverview: {
        totalRegistered: totalUsersCount,
        onlineActive: onlineCount,
        offlineCount: Math.max(0, totalUsersCount - onlineCount),
      },
      recentGenerations: (recentTasksRes.data || []).map((t: any) => {
        let mediaUrl: string | null = null;
        if (t.outputs) {
          if (Array.isArray(t.outputs)) {
            for (const out of t.outputs) {
              if (typeof out === 'string') { mediaUrl = out; break; }
              if (out && typeof out === 'object') {
                const candidate = out.fileUrl || out.url || out.outputUrl || out.download_url || out.src;
                if (candidate) { mediaUrl = candidate; break; }
              }
            }
          } else if (typeof t.outputs === 'string') {
            mediaUrl = t.outputs;
          }
        }
        return {
          id: t.id,
          appName: t.app_name || 'Studio Generation',
          createdAt: t.created_at,
          userName: t.users?.name || (t.users?.email ? t.users.email.split('@')[0] : 'Creator'),
          userEmail: t.users?.email,
          outputUrl: mediaUrl,
        };
      }),
      keys: {
        enterprise: {
          configured: Boolean(enterpriseKey),
          masked: enterpriseKey ? `${enterpriseKey.slice(0, 6)}••••••••${enterpriseKey.slice(-4)}` : 'Not Configured',
          status: liveEnterprise ? 'ONLINE' : 'UNREACHABLE',
          apiType: 'Enterprise Master Channel',
          coins: liveEnterprise?.remainCoins || '0',
          money: liveEnterprise?.remainMoney || '0.00',
        },
        consumer: {
          configured: Boolean(consumerKey),
          masked: consumerKey ? `${consumerKey.slice(0, 6)}••••••••${consumerKey.slice(-4)}` : 'Not Configured',
          status: liveConsumer ? 'ONLINE' : 'UNREACHABLE',
          apiType: 'Consumer Secondary Channel',
          coins: liveConsumer?.remainCoins || '0',
          money: liveConsumer?.remainMoney || '0.00',
        },
      },
    });
  } catch (error: any) {
    console.error('[GET /api/admin/wallet] Error:', error);
    return NextResponse.json({ error: error.message || 'Failed to fetch cloud engine live balance' }, { status: 500 });
  }
}
