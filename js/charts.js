// web/js/charts.js
// Chart.js 기반 인포그래픽 차트 관리 모듈

const ChartManager = {
  categoryShareChart: null,
  categoryCompareChart: null,
  newProjectsChart: null,

  // 고품격 비즈니스/국방 테마 색상 팔레트
  palette: [
    '#1B365D', // Deep Navy
    '#0066FF', // Tech Blue
    '#00C49F', // Emerald Teal
    '#FFBB28', // Gold Yellow
    '#FF8042', // Warm Orange
    '#8884D8', // Soft Purple
    '#0088FE', // Vivid Blue
    '#FF6E76', // Coral Red
    '#5856D6', // Indigo
    '#4CD964'  // Spring Green
  ],

  /**
   * 차트 전체 갱신
   * @param {Array} items 현재 필터링/전체 데이터
   */
  updateCharts(items) {
    this.renderCategoryShare(items);
    this.renderCategoryCompare(items);
    this.renderNewProjectsRank(items);
  },

  /**
   * 1. 분야별 예산 비중 (도넛 차트)
   */
  renderCategoryShare(items) {
    const ctx = document.getElementById('categoryShareChart');
    if (!ctx) return;

    // 분야별 2027년 예산 집계
    const catMap = {};
    items.forEach(item => {
      const cat = item.category.replace(/^[①-⑩\d\.\s\[\]]+/, '').trim() || item.category;
      catMap[cat] = (catMap[cat] || 0) + item.curBudget;
    });

    const labels = Object.keys(catMap);
    const data = Object.values(catMap);

    if (this.categoryShareChart) {
      this.categoryShareChart.destroy();
    }

    this.categoryShareChart = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels,
        datasets: [{
          data,
          backgroundColor: this.palette.slice(0, labels.length),
          borderWidth: 2,
          borderColor: '#ffffff',
          hoverOffset: 8
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              boxWidth: 12,
              padding: 12,
              font: { family: 'Pretendard, Malgun Gothic', size: 12 }
            }
          },
          tooltip: {
            callbacks: {
              label: (context) => {
                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                const value = context.parsed;
                const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : 0;
                return ` ${context.label}: ${value.toLocaleString()} 억원 (${percentage}%)`;
              }
            }
          }
        },
        cutout: '62%'
      }
    });
  },

  /**
   * 2. 분야별 2026 vs 2027 예산 비교 (막대 차트)
   */
  renderCategoryCompare(items) {
    const ctx = document.getElementById('categoryCompareChart');
    if (!ctx) return;

    // 분야별 집계
    const catMap = {};
    items.forEach(item => {
      const shortCat = item.category.replace(/^[①-⑩\d\.\s\[\]]+/, '').trim() || item.category;
      if (!catMap[shortCat]) {
        catMap[shortCat] = { prev: 0, cur: 0 };
      }
      catMap[shortCat].prev += item.prevBudget;
      catMap[shortCat].cur += item.curBudget;
    });

    const labels = Object.keys(catMap);
    const prevData = labels.map(l => catMap[l].prev);
    const curData = labels.map(l => catMap[l].cur);

    if (this.categoryCompareChart) {
      this.categoryCompareChart.destroy();
    }

    this.categoryCompareChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: '2026년 예산',
            data: prevData,
            backgroundColor: '#CBD5E1', // Grayish Blue
            borderRadius: 6
          },
          {
            label: '2027년 정부안',
            data: curData,
            backgroundColor: '#1E40AF', // Navy Blue
            borderRadius: 6
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: {
            grid: { display: false },
            ticks: { font: { family: 'Pretendard, Malgun Gothic', size: 11 } }
          },
          y: {
            beginAtZero: true,
            ticks: {
              callback: (val) => val.toLocaleString() + ' 억'
            }
          }
        },
        plugins: {
          legend: {
            position: 'top',
            labels: { boxWidth: 12, font: { size: 12 } }
          },
          tooltip: {
            callbacks: {
              label: (context) => ` ${context.dataset.label}: ${context.parsed.y.toLocaleString()} 억원`
            }
          }
        }
      }
    });
  },

  /**
   * 3. 신규사업 예산 규모 Top 랭킹 (수평 막대 차트)
   */
  renderNewProjectsRank(allItems) {
    const ctx = document.getElementById('newProjectsChart');
    if (!ctx) return;

    // 신규사업 필터링 및 예산순 정렬
    const newItems = allItems
      .filter(item => item.isNew)
      .sort((a, b) => b.curBudget - a.curBudget)
      .slice(0, 7); // 상위 7개

    const labels = newItems.map(item => {
      const clean = item.name.replace(/\(신규\)/g, '').trim();
      return clean.length > 14 ? clean.substring(0, 14) + '...' : clean;
    });
    const data = newItems.map(item => item.curBudget);

    if (this.newProjectsChart) {
      this.newProjectsChart.destroy();
    }

    this.newProjectsChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: '2027년 예산 (억원)',
          data,
          backgroundColor: '#059669', // Emerald Green Accent
          borderRadius: 6
        }]
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: {
            beginAtZero: true,
            ticks: {
              callback: (val) => val.toLocaleString() + ' 억'
            }
          },
          y: {
            grid: { display: false },
            ticks: { font: { family: 'Pretendard, Malgun Gothic', size: 11 } }
          }
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => ` 2027년 신규예산: ${ctx.parsed.x.toLocaleString()} 억원`
            }
          }
        }
      }
    });
  }
};
