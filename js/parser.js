// web/js/parser.js
// 엑셀(.xlsx, .xls) 및 CSV 파일 파싱 및 데이터 정규화 모듈

const DataParser = {
  /**
   * 파일을 받아 데이터 배열을 Promise로 반환
   * @param {File} file 
   * @returns {Promise<Array>}
   */
  async parseFile(file) {
    const fileName = file.name.toLowerCase();
    if (fileName.endsWith('.csv')) {
      const text = await this.readFileAsText(file);
      return this.parseCSV(text);
    } else if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
      const buffer = await this.readFileAsArrayBuffer(file);
      return this.parseExcel(buffer);
    } else {
      throw new Error('지원하지 않는 파일 형식입니다. (.xlsx, .xls, .csv 만 가능)');
    }
  },

  readFileAsText(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = (e) => reject(e);
      // UTF-8 우선 시도, 한글 완성형(EUC-KR) 고려
      reader.readAsText(file, 'utf-8');
    });
  },

  readFileAsArrayBuffer(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = (e) => reject(e);
      reader.readAsArrayBuffer(file);
    });
  },

  /**
   * SheetJS 라이브러리를 활용한 엑셀 파싱
   */
  parseExcel(buffer) {
    if (typeof XLSX === 'undefined') {
      throw new Error('SheetJS(XLSX) 라이브러리가 로드되지 않았습니다.');
    }
    const workbook = XLSX.read(buffer, { type: 'array' });
    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];
    // header: 1로 2차원 배열 추출
    const rawRows = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
    return this.processRawRows(rawRows);
  },

  /**
   * 바닐라 자바스크립트 CSV 파서 (PapaParse가 로드되어 있으면 활용)
   */
  parseCSV(text) {
    if (typeof Papa !== 'undefined') {
      const parsed = Papa.parse(text, { skipEmptyLines: true });
      return this.processRawRows(parsed.data);
    }
    // Fallback 바닐라 파서 (따옴표 및 줄바꿈 처리)
    const rows = [];
    let currentRow = [];
    let currentCell = '';
    let insideQuote = false;

    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      const nextChar = text[i + 1];

      if (char === '"') {
        if (insideQuote && nextChar === '"') {
          currentCell += '"';
          i++; // skip escaped quote
        } else {
          insideQuote = !insideQuote;
        }
      } else if (char === ',' && !insideQuote) {
        currentRow.push(currentCell.trim());
        currentCell = '';
      } else if ((char === '\r' || char === '\n') && !insideQuote) {
        if (char === '\r' && nextChar === '\n') i++;
        currentRow.push(currentCell.trim());
        if (currentRow.some(c => c !== '')) {
          rows.push(currentRow);
        }
        currentRow = [];
        currentCell = '';
      } else {
        currentCell += char;
      }
    }
    if (currentCell || currentRow.length > 0) {
      currentRow.push(currentCell.trim());
      if (currentRow.some(c => c !== '')) rows.push(currentRow);
    }

    return this.processRawRows(rows);
  },

  /**
   * 2차원 원본 행 배열에서 헤더를 탐지하고 정규화된 객체 리스트로 변환
   */
  processRawRows(rows) {
    if (!rows || rows.length < 2) {
      throw new Error('파일에 데이터 행이 부족합니다.');
    }

    // 헤더 행 찾기 (연번, 분야, 세부 사업 등의 단어가 포함된 첫 번째 행)
    let headerRowIdx = -1;
    for (let i = 0; i < Math.min(rows.length, 10); i++) {
      const rowStr = rows[i].map(c => String(c).trim()).join(' ');
      if (rowStr.includes('분야') || rowStr.includes('사업') || rowStr.includes('연번')) {
        headerRowIdx = i;
        break;
      }
    }

    if (headerRowIdx === -1) {
      headerRowIdx = 0; // 탐지 실패 시 첫 행을 헤더로 간주
    }

    const headers = rows[headerRowIdx].map(c => String(c).trim().replace(/\s+/g, ' '));
    const columnMap = this.mapColumns(headers);

    const items = [];
    for (let r = headerRowIdx + 1; r < rows.length; r++) {
      const row = rows[r];
      if (!row || row.length === 0) continue;

      // 사업명 또는 분야가 비어있으면 스킵
      const name = this.getCellValue(row, columnMap.name);
      const category = this.getCellValue(row, columnMap.category);
      if (!name && !category) continue;

      const prevBudget = this.parseNumber(this.getCellValue(row, columnMap.prevBudget));
      const curBudget = this.parseNumber(this.getCellValue(row, columnMap.curBudget));
      let diff = this.parseNumber(this.getCellValue(row, columnMap.diff));
      if (isNaN(diff) || diff === 0) {
        diff = Number((curBudget - prevBudget).toFixed(2));
      }

      let rawRate = this.getCellValue(row, columnMap.diffRate);
      let diffRate = rawRate;
      if (!diffRate && prevBudget > 0) {
        diffRate = ((diff / prevBudget) * 100).toFixed(1) + '%';
      }

      const notes = this.getCellValue(row, columnMap.notes);
      const unit = this.getCellValue(row, columnMap.unit) || '억원';
      const id = parseInt(this.getCellValue(row, columnMap.id), 10) || (items.length + 1);

      // 신규사업 판별
      const isNew = this.detectIsNew(name, diffRate, prevBudget, curBudget, notes);

      items.push({
        id,
        category: category || '기타 / 공통',
        name: name || '세부 사업 미지정',
        unit,
        prevBudget,
        curBudget,
        diff,
        diffRate: diffRate || (isNew ? '신규' : '0.0%'),
        isNew,
        notes: notes || '-'
      });
    }

    if (items.length === 0) {
      throw new Error('유효한 데이터 행을 파싱하지 못했습니다. 서식을 확인해 주세요.');
    }

    return items;
  },

  /**
   * 컬럼 헤더 자동 매핑
   */
  mapColumns(headers) {
    const map = {
      id: -1,
      category: -1,
      name: -1,
      unit: -1,
      prevBudget: -1,
      curBudget: -1,
      diff: -1,
      diffRate: -1,
      notes: -1
    };

    headers.forEach((h, idx) => {
      const clean = h.replace(/[\s\(\)\[\]_\-]/g, '').toLowerCase();
      
      if (map.id === -1 && (clean.includes('연번') || clean.includes('no') || clean.includes('id') || clean === '순번')) {
        map.id = idx;
      } else if (map.category === -1 && (clean.includes('분야') || clean.includes('중점영역') || clean.includes('영역') || clean.includes('구분분야'))) {
        map.category = idx;
      } else if (map.name === -1 && (clean.includes('세부사업') || clean.includes('사업명') || clean.includes('주요지표') || clean.includes('중점사업'))) {
        map.name = idx;
      } else if (map.unit === -1 && (clean.includes('단위') || clean.includes('구분단위'))) {
        map.unit = idx;
      } else if (map.prevBudget === -1 && (clean.includes('2026') || clean.includes('전년') || clean.includes('예산a') || clean === 'a')) {
        map.prevBudget = idx;
      } else if (map.curBudget === -1 && (clean.includes('2027') || clean.includes('정부안') || clean.includes('당해') || clean.includes('예산b') || clean === 'b')) {
        map.curBudget = idx;
      } else if (map.diff === -1 && (clean.includes('증감액') || clean.includes('증감') || clean.includes('ba'))) {
        map.diff = idx;
      } else if (map.diffRate === -1 && (clean.includes('증가율') || clean.includes('증감률') || clean.includes('변동률') || clean.includes('rate'))) {
        map.diffRate = idx;
      } else if (map.notes === -1 && (clean.includes('핵심') || clean.includes('보도자료') || clean.includes('원문') || clean.includes('근거') || clean.includes('내용') || clean.includes('비고'))) {
        map.notes = idx;
      }
    });

    // 기본 위치(A~I) 폴백
    if (map.id === -1) map.id = 0;
    if (map.category === -1) map.category = 1;
    if (map.name === -1) map.name = 2;
    if (map.unit === -1) map.unit = 3;
    if (map.prevBudget === -1) map.prevBudget = 4;
    if (map.curBudget === -1) map.curBudget = 5;
    if (map.diff === -1) map.diff = 6;
    if (map.diffRate === -1) map.diffRate = 7;
    if (map.notes === -1) map.notes = 8;

    return map;
  },

  getCellValue(row, idx) {
    if (idx === -1 || idx >= row.length || row[idx] === undefined || row[idx] === null) return '';
    return String(row[idx]).trim();
  },

  parseNumber(val) {
    if (!val) return 0;
    // 쉼표, 원, 억 등 제거
    const clean = String(val).replace(/,/g, '').replace(/[^\d.-]/g, '');
    const num = parseFloat(clean);
    return isNaN(num) ? 0 : num;
  },

  /**
   * 신규 사업 여부 판정
   */
  detectIsNew(name, diffRate, prevBudget, curBudget, notes) {
    if (typeof name === 'string' && name.includes('(신규)')) return true;
    if (typeof diffRate === 'string' && (diffRate.includes('신규') || diffRate.includes('순증'))) return true;
    if (typeof notes === 'string' && (notes.includes('(신규)') || notes.includes('신규 확보') || notes.includes('신설'))) return true;
    if (prevBudget === 0 && curBudget > 0) return true;
    return false;
  }
};
