(function(){
  var p = document.createElement('p');
  p.innerHTML = window.dependency1 && window.dependency2 ? "Dependee 3 loaded! This text is from an external script." : "Dependee 3 can't load! Missing dependencies.";
  document.body.appendChild(p);
})();