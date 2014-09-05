(function(){
  window.dependency1 = true;
  var p = document.createElement('p');
  p.innerHTML = "Dependency 1 loaded! This text is from an external script.";
  document.body.appendChild(p);
})();