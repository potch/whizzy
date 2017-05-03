window.addEventListener('load', function () {
  console.log('repos');
  let repoEl = document.querySelector('[data-repo]');
  
  let repos;

  try {
    repos = JSON.parse(localStorage.getItem('recent-repos')) || [];
  } catch (e) {
    repos = [];
  }

  if (repoEl) {
    let repoString = repoEl.getAttribute('data-repo');
    if (repos.indexOf(repoString) < 0) {
      repos.unshift(repoString);
    }
    localStorage.setItem('recent-repos', JSON.stringify(repos));
  }
  
  let listEl = document.querySelector('.recent-repos');
  if (listEl) {
    repos.forEach(function (r) {
      let item = document.createElement('li');
      let link = document.createElement('a');
      link.href = '/repo/' + r;
      link.appendChild(document.createTextNode(r));
      item.appendChild(link);
      listEl.appendChild(item);
    });
  }
});