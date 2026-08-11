const fs = require('fs');
fetch('https://erail.in/')
  .then(r => r.text())
  .then(html => {
     const scripts = html.match(/<script.*?src=["'](.*?)["']/g);
     console.log(scripts);
  });
