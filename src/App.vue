<script setup>
import { ref, onMounted, onBeforeUnmount, watch, inject } from 'vue'
import * as echarts from 'echarts/core'
import { HeatmapChart } from 'echarts/charts'
import { GridComponent, TooltipComponent, VisualMapComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import { Helper } from './services/Helper.js'

echarts.use([HeatmapChart, GridComponent, TooltipComponent, VisualMapComponent, CanvasRenderer])

const state = inject('widgetState', {
  conf: {},
  context: {},
  zbx: {},
})

const props = defineProps({
  conf: { type: null, required: false },
  context: { type: null, required: false },
  zbx: { type: null, required: false },
})

const chartEl = ref(null)
const hosts = ref([])
let chart = null
const helper = ref(null)

function buildOption(hosts) {
  const width = chart.getWidth()
  const height = chart.getHeight()

  const N = hosts.length
  const { cols, rows } = Helper.bestGridForSquareCells(N, width, height)

  const xCats = Helper.generateAxisCategories(cols)
  const yCats = Helper.generateAxisCategories(rows)

  const cellWidthPx = width / cols
  const { nameCharLimit, alarmCharLimit } = Helper.calculateCharLimits(cellWidthPx)

  // Heatmap data format required by ECharts: [xCategory, yCategory, severityValue]
  const chartData = hosts.map((host, i) => {
    host.alarms.sort((a, b) => b.severity - a.severity)
    const maxSeverity = host.alarms.length > 0 ? host.alarms[0].severity : 6
    const x = i % cols
    const y = Math.floor(i / cols)
    return [String(x), String(y), maxSeverity]
  })

  return {
    backgroundColor: '#ffffff',
    tooltip: {
      confine: true,
      formatter: (p) => {
        const host = hosts[p.dataIndex]
        const alarmHtml = Helper.generateAlarmHtml(host.alarms)
        return `<div style="font-weight:bold; border-bottom:1px solid #ccc; margin-bottom:8px; padding-bottom:5px;">${host.hostname}</div>${alarmHtml}`
      },
    },
    grid: { top: 10, bottom: 10, left: 10, right: 10 },

    xAxis: {
      type: 'category',
      data: xCats,
      show: false,
      boundaryGap: true,
    },
    yAxis: {
      type: 'category',
      data: yCats,
      show: false,
      inverse: true,
      boundaryGap: true,
    },

    visualMap: {
      type: 'piecewise',
      show: false,
      pieces: [
        { value: 0, color: Helper.ZABBIX_COLORS[0] },
        { value: 1, color: Helper.ZABBIX_COLORS[1] },
        { value: 2, color: Helper.ZABBIX_COLORS[2] },
        { value: 3, color: Helper.ZABBIX_COLORS[3] },
        { value: 4, color: Helper.ZABBIX_COLORS[4] },
        { value: 5, color: Helper.ZABBIX_COLORS[5] },
        { value: 6, color: Helper.ZABBIX_COLORS[6] },
      ],
    },

    series: [
      {
        type: 'heatmap',
        data: chartData,
        cursor: 'pointer',

        label: {
          show: true,
          formatter: (params) => {
            const host = hosts[params.dataIndex]
            const truncatedName = Helper.truncateText(host.hostname, nameCharLimit)

            const displayedAlarms = host.alarms
              .slice(0, 3)
              .map((a) => Helper.truncateText(a.message, alarmCharLimit))
              .join('\n')

            return `{name|${truncatedName}}${
              displayedAlarms ? '\n{alarm|' + displayedAlarms + '}' : '\n{ok|✓ OK}'
            }`
          },
          rich: {
            name: {
              fontWeight: 'bold',
              fontSize: 11,
              color: '#fff',
              align: 'center',
              lineHeight: 16,
              padding: [0, 0, 2, 0],
            },
            alarm: { fontSize: 9, color: '#f0f0f0', align: 'center', lineHeight: 11 },
            ok: { fontSize: 10, fontWeight: 'bold', color: '#fff', align: 'center' },
          },
        },

        itemStyle: { borderColor: '#fff', borderWidth: 10, borderRadius: 10 },
        emphasis: {
          itemStyle: {
            borderWidth: 2,
            borderColor: '#777',
          },
        },
      },
    ],
  }
}

function attachHandlers(hosts) {
  chart.off('click')
  chart.on('click', (params) => {
    const host = hosts[params.dataIndex]
    window.open(
      `zabbix.php?action=problem.view&hostids%5B%5D=${encodeURIComponent(host.hostid)}`,
      '_blank',
    )
  })
}

/**
 * Push freshly built options into chart instance.
 */
function render() {
  if (!chart) return
  chart.setOption(buildOption(hosts.value))
  attachHandlers(hosts.value)
}

/**
 * Resize handler used by window events.
 *
 * Why both `chart.resize()` and `render()`?
 * - `chart.resize()` updates internal canvas dimensions.
 * - `render()` rebuilds grid layout and text truncation rules based on new width.
 */
function resize() {
  if (!chart) return
  chart.resize()
  render()
}

onMounted(async () => {
  // Create ECharts instance after Vue template is mounted into DOM.
  chart = echarts.init(chartEl.value)

  helper.value = new Helper({ apiUrl: props.conf?.apiurl, apiToken: props.conf?.apikey })
  const hostgroup = props.conf?.hostgroup || 'test'
  try {
    hosts.value = await helper.value.getLiveAlarms(hostgroup)
  } catch (err) {
    hosts.value = []
    console.error(`getLiveAlarms("${hostgroup}") failed:`, err)
  }

  // Perform first draw and register interactions.
  resize()

  // Keep chart responsive when host container size changes.
  window.addEventListener('resize', resize)
})

onBeforeUnmount(() => {
  // Remove listeners and free ECharts resources to avoid memory leaks.
  window.removeEventListener('resize', resize)
  if (chart) {
    chart.dispose()
    chart = null
  }
})

// Re-render on update() from wrapper.
watch(
  () => state.conf,
  async () => {
    if (!helper.value) return
    const hostgroup = props.conf?.hostgroup

    try {
      hosts.value = await helper.value.getLiveAlarms(hostgroup)
    } catch (err) {
      hosts.value = []
      console.error(`getLiveAlarms("${hostgroup}") failed:`, err)
    }

    render()
  },
  { deep: true },
)
</script>

<template>
  <!--
    Single root render node for ECharts.
    It stretches to full size of parent container.
  -->
  <div ref="chartEl" class="chart"></div>
</template>

<style scoped>
/*
 * Critical for embedding:
 * chart element must occupy full parent area.
 * Parent dimensions are provided by host environment (index.html in demo,
 * Zabbix widget container in production).
 */
.chart {
  width: 100%;
  height: 100%;
}
</style>
