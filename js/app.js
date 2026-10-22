// web/js/app.js
// 메인 애플리케이션 라이프사이클 및 이벤트 버스

const App = {
  rawItems: [],
  filteredItems: [],
  selectedCategory: 'ALL',
  onlyNew: false,
  searchQuery: '',
  sortCol: 'id',
  sortAsc: true,

  init() {
    this.bindEvents();
    // 초기에는 샘플 데이터셋으로 시동
    this.loadData(SAMPLE_BUDGET_DATA);
  },

  loadData(items) {
    this.rawItems = items;
    this.selectedCategory = 'ALL';
    this.onlyNew = false;
    this.searchQuery = '';
    
    // UI 입력값 초기화
    const searchInput = document.getElementById('searchInput');
    if (searchInput) searchInput.value = '';
    const newToggle = document.getElementById('newProjectToggle');
    if (newToggle) newToggle.checked = false;

    // 고유 분야 리스트 추출
    const categories = Array.from(new Set(items.map(i => i.category))).filter(Boolean);
    DashboardRenderer.renderCategoryTabs(categories, this.selectedCategory, (cat) => {
      this.selectedCategory = cat;
      this.applyFilter();
    });

    this.applyFilter();
  },

  applyFilter() {
    let result = [...this.rawItems];

    // 1. 분야 필터
    if (this.selectedCategory !== 'ALL') {
      result = result.filter(item => item.category === this.selectedCategory);
    }

    // 2. 신규사업 전용 토글
    if (this.onlyNew) {
      result = result.filter(item => item.isNew);
    }

    // 3. 검색어 필터
    if (this.searchQuery) {
      const q = this.searchQuery.toLowerCase();
      result = result.filter(item => 
        item.name.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q) ||
        item.notes.toLowerCase().includes(q)
      );
    }

    // 4. 정렬
    result.sort((a, b) => {
      let valA = a[this.sortCol];
      let valB = b[this.sortCol];

      if (typeof valA === 'string') {
        const cmp = valA.localeCompare(valB, 'ko');
        return this.sortAsc ? cmp : -cmp;
      }
      return this.sortAsc ? (valA - valB) : (valB - valA);
    });

    this.filteredItems = result;
    this.renderAll();
  },

  renderAll() {
    // 1. 상단 KPI 요약
    DashboardRenderer.renderKPIs(this.filteredItems);

    // 2. 인포그래픽 카드 덱
    DashboardRenderer.renderInfographicCards(this.filteredItems);

    // 3. 데이터 테이블
    DashboardRenderer.renderTable(this.filteredItems);

    // 4. 차트 갱신 (전체 또는 현재 필터 데이터 기반)
    ChartManager.updateCharts(this.filteredItems);

    // 5. 탭 활성 상태 동기화
    document.querySelectorAll('.tab-btn').forEach(btn => {
      if (this.selectedCategory === 'ALL' && btn.textContent === '전체 분야 보기') {
        btn.classList.add('active');
      } else if (btn.textContent === this.selectedCategory) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });
  },

  bindEvents() {
    // 1. 파일 업로드 인풋 및 드롭존
    const fileInput = document.getElementById('fileInput');
    const dropZone = document.getElementById('dropZone');

    if (fileInput) {
      fileInput.addEventListener('change', async (e) => {
        if (e.target.files && e.target.files[0]) {
          await this.handleFileUpload(e.target.files[0]);
          e.target.value = ''; // 동일 파일 재업로드 가능
        }
      });
    }

    if (dropZone) {
      ['dragenter', 'dragover'].forEach(name => {
        dropZone.addEventListener(name, (e) => {
          e.preventDefault();
          dropZone.classList.add('dragover');
        });
      });
      ['dragleave', 'drop'].forEach(name => {
        dropZone.addEventListener(name, (e) => {
          e.preventDefault();
          dropZone.classList.remove('dragover');
        });
      });
      dropZone.addEventListener('drop', async (e) => {
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
          await this.handleFileUpload(e.dataTransfer.files[0]);
        }
      });
    }

    // 2. 샘플 데이터 복원 버튼
    const btnResetSample = document.getElementById('btnResetSample');
    if (btnResetSample) {
      btnResetSample.addEventListener('click', () => {
        this.loadData(SAMPLE_BUDGET_DATA);
        this.showToast('기본 국방예산 샘플 데이터가 성공적으로 로드되었습니다.');
      });
    }

    // 3. 신규사업 토글
    const newToggle = document.getElementById('newProjectToggle');
    if (newToggle) {
      newToggle.addEventListener('change', (e) => {
        this.onlyNew = e.target.checked;
        this.applyFilter();
      });
    }

    // 4. 검색창 이벤트
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.searchQuery = e.target.value.trim();
        this.applyFilter();
      });
    }

    // 5. 모달 닫기
    const modalCloseBtn = document.getElementById('modalCloseBtn');
    const modalBackdrop = document.getElementById('detailModal');
    if (modalCloseBtn) modalCloseBtn.onclick = () => DashboardRenderer.closeModal();
    if (modalBackdrop) {
      modalBackdrop.onclick = (e) => {
        if (e.target === modalBackdrop) DashboardRenderer.closeModal();
      };
    }
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') DashboardRenderer.closeModal();
    });

    // 6. 테이블 정렬 바인딩
    document.querySelectorAll('th[data-sort]').forEach(th => {
      th.addEventListener('click', () => {
        const col = th.getAttribute('data-sort');
        if (this.sortCol === col) {
          this.sortAsc = !this.sortAsc;
        } else {
          this.sortCol = col;
          this.sortAsc = true;
        }
        // 헤더 아이콘 갱신
        document.querySelectorAll('th[data-sort]').forEach(h => h.classList.remove('sort-asc', 'sort-desc'));
        th.classList.add(this.sortAsc ? 'sort-asc' : 'sort-desc');
        this.applyFilter();
      });
    });

    // 7. 인쇄 / 내보내기 버튼
    const btnPrint = document.getElementById('btnPrintReport');
    if (btnPrint) {
      btnPrint.addEventListener('click', () => window.print());
    }

    // 8. 엑셀 파일 저장 버튼 이벤트 바인딩
    const btnHeaderExport = document.getElementById('btnHeaderExportExcel');
    if (btnHeaderExport) {
      btnHeaderExport.addEventListener('click', () => this.exportToExcel());
    }

    const btnTableExport = document.getElementById('btnTableExportExcel');
    if (btnTableExport) {
      btnTableExport.addEventListener('click', () => this.exportToExcel());
    }
  },

  /**
   * 종합대시보드 전체 사업 데이터 목록을 엑셀(.xlsx) 파일로 내보내기
   */
  exportToExcel() {
    if (!this.filteredItems || this.filteredItems.length === 0) {
      alert('내보낼 사업 데이터가 없습니다.');
      return;
    }

    if (typeof XLSX === 'undefined') {
      alert('SheetJS 라이브러리를 불러오지 못했습니다.');
      return;
    }

    // 원본 서식과 동일한 헤더로 데이터 매핑
    const exportRows = this.filteredItems.map(item => ({
      '연번': item.id,
      '분야 (중점영역)': item.category,
      '세부 사업 / 주요 지표': item.name,
      '구분/단위': item.unit,
      '2026년 (A)': item.prevBudget,
      '2027년 정부안 (B)': item.curBudget,
      '증감 (B-A)': item.diff,
      '증가율 (%)': item.diffRate,
      '핵심 내용 및 보도자료 박스 원문 근거': item.notes
    }));

    // 워크시트 생성
    const worksheet = XLSX.utils.json_to_sheet(exportRows);

    // 열 너비(컬럼 폭) 자동 최적화
    worksheet['!cols'] = [
      { wch: 8 },  // 연번
      { wch: 28 }, // 분야 (중점영역)
      { wch: 38 }, // 세부 사업 / 주요 지표
      { wch: 12 }, // 구분/단위
      { wch: 16 }, // 2026년 (A)
      { wch: 18 }, // 2027년 정부안 (B)
      { wch: 16 }, // 증감 (B-A)
      { wch: 14 }, // 증가율 (%)
      { wch: 65 }  // 핵심 내용 및 보도자료 박스 원문 근거
    ];

    // 워크북 생성 및 시트 추가
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, '사업데이터_목록');

    // 파일명 생성 (예: 2027_국방예산_사업목록_20261022.xlsx)
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const filterSuffix = this.onlyNew ? '_신규사업' : (this.selectedCategory !== 'ALL' ? `_${this.selectedCategory.slice(0, 8)}` : '');
    const fileName = `국방예산_사업목록${filterSuffix}_${today}.xlsx`;

    // 엑셀 파일 저장 트리거
    XLSX.writeFile(workbook, fileName);
    this.showToast(`총 ${this.filteredItems.length}개 사업 데이터가 [${fileName}] 파일로 다운로드되었습니다.`);
  },

  async handleFileUpload(file) {
    try {
      this.showLoading(true);
      const parsedItems = await DataParser.parseFile(file);
      this.loadData(parsedItems);
      this.showToast(`[${file.name}] 파일이 성공적으로 로드되었습니다. (${parsedItems.length}개 항목)`);
    } catch (err) {
      alert('파일 파싱 중 오류가 발생했습니다: ' + err.message);
      console.error(err);
    } finally {
      this.showLoading(false);
    }
  },

  showLoading(show) {
    const loader = document.getElementById('globalLoader');
    if (loader) loader.style.display = show ? 'flex' : 'none';
  },

  showToast(message) {
    const toast = document.getElementById('toast');
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 3500);
  }
};

// DOM 로드 완료 후 실행
document.addEventListener('DOMContentLoaded', () => {
  App.init();
});
