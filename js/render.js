// web/js/render.js
// DOM 컴포넌트 (KPI, 인포그래픽 카드, 테이블, 모달) 렌더링 모듈

const DashboardRenderer = {
  /**
   * 상단 거시 요약 KPI 카드 렌더링
   */
  renderKPIs(items) {
    const totalPrev = items.reduce((sum, item) => sum + item.prevBudget, 0);
    const totalCur = items.reduce((sum, item) => sum + item.curBudget, 0);
    const totalDiff = totalCur - totalPrev;
    const diffRate = totalPrev > 0 ? ((totalDiff / totalPrev) * 100).toFixed(1) : '100.0';

    const newItems = items.filter(item => item.isNew);
    const totalNewBudget = newItems.reduce((sum, item) => sum + item.curBudget, 0);

    // DOM 업데이트
    document.getElementById('kpiTotalCur').textContent = totalCur.toLocaleString();
    document.getElementById('kpiTotalPrev').textContent = totalPrev.toLocaleString();
    
    const diffEl = document.getElementById('kpiTotalDiff');
    const isPositive = totalDiff >= 0;
    diffEl.textContent = (isPositive ? '+' : '') + totalDiff.toLocaleString();
    diffEl.className = isPositive ? 'value positive' : 'value negative';

    const rateEl = document.getElementById('kpiDiffRate');
    rateEl.textContent = (isPositive ? '+' : '') + diffRate + '%';
    rateEl.className = 'badge ' + (isPositive ? 'badge-up' : 'badge-down');

    document.getElementById('kpiProjectCount').textContent = items.length;
    document.getElementById('kpiNewCount').textContent = newItems.length;
    document.getElementById('kpiNewBudget').textContent = totalNewBudget.toLocaleString();
  },

  /**
   * 분야별 탭 네비게이션 생성
   */
  renderCategoryTabs(categories, selectedCategory, onSelect) {
    const container = document.getElementById('categoryTabs');
    if (!container) return;
    container.innerHTML = '';

    const allBtn = document.createElement('button');
    allBtn.className = `tab-btn ${selectedCategory === 'ALL' ? 'active' : ''}`;
    allBtn.textContent = '전체 분야 보기';
    allBtn.onclick = () => onSelect('ALL');
    container.appendChild(allBtn);

    categories.forEach(cat => {
      const btn = document.createElement('button');
      btn.className = `tab-btn ${selectedCategory === cat ? 'active' : ''}`;
      btn.textContent = cat;
      btn.onclick = () => onSelect(cat);
      container.appendChild(btn);
    });
  },

  /**
   * 인포그래픽 카드 덱 렌더링
   */
  renderInfographicCards(items) {
    const container = document.getElementById('cardGrid');
    if (!container) return;
    container.innerHTML = '';

    if (items.length === 0) {
      container.innerHTML = '<div class="no-data">조건에 해당하는 사업 데이터가 없습니다.</div>';
      return;
    }

    items.forEach(item => {
      const card = document.createElement('div');
      card.className = `info-card ${item.isNew ? 'is-new' : ''}`;
      card.onclick = () => this.openDetailModal(item);

      const isUp = item.diff >= 0;
      const rateLabel = item.diffRate.includes('%') ? item.diffRate : (item.isNew ? '신규 신설' : item.diffRate);

      card.innerHTML = `
        <div class="card-header">
          <div class="card-category-badge">${this.escapeHtml(item.category)}</div>
          ${item.isNew ? '<span class="badge badge-new">🔥 신규사업</span>' : ''}
        </div>
        <h4 class="card-title">${this.escapeHtml(item.name)}</h4>
        
        <div class="card-metrics">
          <div class="metric-item">
            <span class="metric-label">2026 예산</span>
            <span class="metric-val prev">${item.prevBudget.toLocaleString()} <small>${item.unit}</small></span>
          </div>
          <div class="metric-arrow">➔</div>
          <div class="metric-item">
            <span class="metric-label">2027 정부안</span>
            <span class="metric-val cur">${item.curBudget.toLocaleString()} <small>${item.unit}</small></span>
          </div>
        </div>

        <div class="card-changes">
          <div class="change-diff ${isUp ? 'pos' : 'neg'}">
            <span>증감</span> <strong>${isUp ? '+' : ''}${item.diff.toLocaleString()} ${item.unit}</strong>
          </div>
          <div class="change-rate ${isUp ? 'badge-up' : 'badge-down'}">
            ${isUp ? '▲' : '▼'} ${rateLabel}
          </div>
        </div>

        <div class="card-notes">
          <div class="notes-quote">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" style="opacity:0.6;margin-right:4px;"><path d="M14.017 21v-7.391c0-5.704 3.731-9.57 8.983-10.609l.995 2.151c-2.432.917-3.995 3.638-3.995 5.849h4v10h-9.983zm-14.017 0v-7.391c0-5.704 3.748-9.57 9-10.609l.996 2.151c-2.433.917-3.996 3.638-3.996 5.849h3.983v10h-9.983z"/></svg>
            ${this.escapeHtml(item.notes)}
          </div>
        </div>
      `;
      container.appendChild(card);
    });
  },

  /**
   * 상세 데이터 테이블 렌더링
   */
  renderTable(items) {
    const tbody = document.getElementById('tableBody');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (items.length === 0) {
      tbody.innerHTML = '<tr><td colspan="9" class="no-data">일치하는 데이터가 없습니다.</td></tr>';
      return;
    }

    items.forEach(item => {
      const tr = document.createElement('tr');
      tr.onclick = () => this.openDetailModal(item);
      tr.style.cursor = 'pointer';

      const isUp = item.diff >= 0;

      tr.innerHTML = `
        <td class="text-center font-bold">${item.id}</td>
        <td><span class="table-cat">${this.escapeHtml(item.category)}</span></td>
        <td>
          <div class="name-cell">
            <strong>${this.escapeHtml(item.name)}</strong>
            ${item.isNew ? '<span class="badge badge-sm badge-new">NEW</span>' : ''}
          </div>
        </td>
        <td class="text-center"><span class="badge-unit">${this.escapeHtml(item.unit)}</span></td>
        <td class="text-right num-val">${item.prevBudget.toLocaleString()}</td>
        <td class="text-right num-val highlight">${item.curBudget.toLocaleString()}</td>
        <td class="text-right ${isUp ? 'color-pos' : 'color-neg'}">${isUp ? '+' : ''}${item.diff.toLocaleString()}</td>
        <td class="text-center">
          <span class="badge ${item.isNew ? 'badge-new' : (isUp ? 'badge-up' : 'badge-down')}">
            ${this.escapeHtml(item.diffRate)}
          </span>
        </td>
        <td class="notes-cell" title="${this.escapeHtml(item.notes)}">${this.escapeHtml(item.notes)}</td>
      `;
      tbody.appendChild(tr);
    });
  },

  /**
   * 상세 모달 팝업
   */
  openDetailModal(item) {
    const modal = document.getElementById('detailModal');
    if (!modal) return;

    document.getElementById('modalTitle').textContent = item.name;
    document.getElementById('modalCategory').textContent = item.category;
    document.getElementById('modalUnit').textContent = item.unit;
    document.getElementById('modalPrev').textContent = item.prevBudget.toLocaleString() + ' ' + item.unit;
    document.getElementById('modalCur').textContent = item.curBudget.toLocaleString() + ' ' + item.unit;
    
    const diffEl = document.getElementById('modalDiff');
    const isUp = item.diff >= 0;
    diffEl.textContent = (isUp ? '+' : '') + item.diff.toLocaleString() + ' ' + item.unit;
    diffEl.className = isUp ? 'color-pos' : 'color-neg';

    document.getElementById('modalRate').textContent = item.diffRate;
    document.getElementById('modalNotes').textContent = item.notes;

    const newBadge = document.getElementById('modalNewBadge');
    if (newBadge) {
      newBadge.style.display = item.isNew ? 'inline-block' : 'none';
    }

    modal.classList.add('active');
  },

  closeModal() {
    const modal = document.getElementById('detailModal');
    if (modal) modal.classList.remove('active');
  },

  escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
};
