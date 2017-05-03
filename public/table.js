window.addEventListener('load', function () {
  let tableEl = document.querySelector('[data-table-source]');
  let hot;
  
  if (tableEl) {
    let url = tableEl.getAttribute('data-table-source');
    console.log(url);
    
    fetch(url, { credentials: 'include' })
      .then(r => r.text())
      .then(function (content) {
        let data = atob(content);
        let holder = document.createElement('pre');
        let tableData = Papa.parse(data);
        tableEl.classList.remove('loading');
        tableEl.innerHTML = '';
        console.log(tableData);
        hot = new Handsontable(tableEl, {
          data: tableData.data,
          rowHeaders: true,
          colHeaders: true,
          contextMenu: true
        });
      })
      .catch(console.error.bind(console));
  }
  
  let fileForm = document.querySelector('.file-edit');
  
  if (fileForm) {
    fileForm.addEventListener('submit', function (e) {
      var csv = Papa.unparse(hot.getData());
      fileForm.querySelector('[name="contents"]').value = csv;
    });
    fetch('fork', { credentials: 'include' }).then(console.log.bind(console)).catch(console.error.bind(console));
  }
  
});