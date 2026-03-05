import { ZbxApiClient } from './ZbxApi.js';

/**
 * Helper class with utility methods for data and text manipulation.
 */
export class Helper {
  /**
   * @param {{ apiUrl?: string, apiToken?: string }} [opts]
   */
  constructor(opts) {
    this.apiUrl = opts?.apiUrl;
    this.apiToken = opts?.apiToken;
  }

  /**
   * Zabbix severity colors
   */
  static ZABBIX_COLORS = {
    0: '#97AAB3',
    1: '#7499FF',
    2: '#FFC859',
    3: '#FFA059',
    4: '#E97659',
    5: '#E45959',
    6: '#59DB8F',
  };


  static truncateText(text, maxLength) {
    if (!text) return '';
    return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
  }

  static bestGridForSquareCells(N, W, H) {
    if (N <= 0) return { cols: 0, rows: 0 };
    const idealCols = Math.sqrt(N * (W / H));
    const candidates = [Math.max(1, Math.floor(idealCols)), Math.max(1, Math.ceil(idealCols))].filter(
      (v, i, a) => a.indexOf(v) === i,
    );

    let best = { cols: 1, rows: N, score: Infinity };
    candidates.forEach((cols) => {
      const rows = Math.ceil(N / cols);
      const cellW = W / cols;
      const cellH = H / rows;
      const score = Math.abs(cellW - cellH) / Math.min(cellW, cellH);
      if (score < best.score) best = { cols, rows, score };
    });
    return { cols: best.cols, rows: best.rows };
  }

  static generateAlarmHtml(alarms) {
    if (alarms.length === 0) {
      return '<div style="color:#59DB8F">✓ No active alarms</div>';
    }

    return alarms
      .slice(0, 10)
      .map(
        (a) => `
    <div style="margin-bottom:3px; display:flex; align-items:baseline;">
      <span style="display:inline-block; width:10px; height:10px; border-radius:50%; background:${this.ZABBIX_COLORS[a.severity]}; margin-right:8px; flex-shrink:0;"></span>
      <span style="font-size:12px;">${a.message}</span>
    </div>`,
      )
      .join('');
  }


  static generateAxisCategories(count) {
    return Array.from({ length: count }, (_, i) => String(i));
  }


  static calculateCharLimits(cellWidthPx) {
    return {
      nameCharLimit: Math.max(5, Math.floor((cellWidthPx - 15) / 9)),
      alarmCharLimit: Math.max(5, Math.floor((cellWidthPx - 15) / 7.5)),
    };
  }

  async getLiveAlarms(hostgroup) {
    if (!hostgroup || hostgroup.trim() === '') {
      return [];
    }

    if (!this.apiToken || this.apiToken.trim() === '') {
      throw new Error('Helper.getLiveAlarms: missing apiToken in Helper constructor options');
    }

    // Keep client local per call: tiny overhead, but no shared mutable state.
    const zbx = new ZbxApiClient(this.apiUrl, this.apiToken);

    /** @type {Array<{ groupid: string }>} */
    // 1) Resolve host group name -> groupid(s)
    const groups = await zbx.call('hostgroup.get', {
      filter: { name: [hostgroup] },
      output: ['groupid', 'name'],
    });

    if (groups.length === 0) {
      return [];
    }

    const groupIds = groups.map((g) => String(g.groupid));

    /** @type {Array<{ hostid: string, host?: string, name?: string }>} */
    // 2) Load all hosts in the requested group.
    // We initialize result map with empty alarm arrays so hosts without problems are preserved.
    const hosts = await zbx.call('host.get', {
      groupids: groupIds,
      output: ['hostid', 'host', 'name'],
    });

    /** @type {Map<string, { hostid: string, hostname: string, alarms: Array<{ severity: number, message: string }> }>} */
    const hostsById = new Map();
    hosts.forEach((h) => {
      const hostId = String(h.hostid);
      hostsById.set(hostId, {
        hostid: hostId,
        hostname: h.name || h.host || `host-${h.hostid}`,
        alarms: [],
      });
    });

    /** @type {Array<{ eventid: string, name?: string, severity?: string | number }>} */
    // 3) Load active problems for the group.
    // problem.get gives eventid + problem payload, but host linkage is not directly included.
    const problems = await zbx.call('problem.get', {
      groupids: groupIds,
      output: ['eventid', 'name', 'severity', 'clock', 'acknowledged'],
    });

    if (problems.length === 0) {
      return Array.from(hostsById.values()).sort((a, b) => a.hostname.localeCompare(b.hostname));
    }

    const eventIds = problems.map((p) => String(p.eventid));

    /** @type {Array<{ eventid: string, hosts?: Array<{ hostid?: string, host?: string, name?: string }> }>} */
    // 4) Resolve event -> host relation in bulk via event.get(selectHosts).
    // This allows us to assign each problem to the correct host(s).
    const events = await zbx.call('event.get', {
      eventids: eventIds,
      output: ['eventid', 'name', 'severity', 'clock', 'acknowledged'],
      selectHosts: ['hostid', 'host', 'name'],
    });

    const hostsByEventId = new Map();
    events.forEach((e) => {
      hostsByEventId.set(String(e.eventid), e.hosts || []);
    });

    // 5) Merge problems into host buckets in the final widget format.
    problems.forEach((p) => {
      const eventId = String(p.eventid);
      const eventHosts = hostsByEventId.get(eventId) || [];

      const alarm = {
        severity: Number(p.severity ?? 0),
        message: p.name || 'Unnamed problem',
      };

      eventHosts.forEach((eh) => {
        const hostId = String(eh.hostid || '');
        if (!hostId) return;
        if (!hostsById.has(hostId)) return;
        hostsById.get(hostId).alarms.push(alarm);
      });
    });

    const result = Array.from(hostsById.values());
    // Keep the most severe alarm first for each host (used by heatmap coloring/labeling).
    result.forEach((h) => h.alarms.sort((a, b) => b.severity - a.severity));

    // Sort hosts alphabecially by name for consistent display order.
    return result.sort((a, b) => a.hostname.localeCompare(b.hostname));
  }
}
