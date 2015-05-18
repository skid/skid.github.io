(function(){
  window.dependency2 = true;
  var p = document.createElement('p');
  p.innerHTML = "Dependency 2 loaded! This text is from an external script.";
  document.body.appendChild(p);
})();