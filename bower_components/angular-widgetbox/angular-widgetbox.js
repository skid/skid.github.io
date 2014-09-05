(function(){
  var slice   = Array.prototype.slice;
  var foreach = Array.prototype.forEach;
  var round   = Math.round;

  function draggableClearCSS(node){
    node.style.position = "";
    node.style.opacity = "1";
    node.style.left = "";
    node.style.top = "";
    node.style.pointerEvents = "";
    node.style.width = "";
  }

  function draggableSetCSS(node){
    node.style.width = node.offsetWidth + "px";
    node.style.position = "absolute";
    node.style.opacity = "0.5";
    node.style.pointerEvents = "none";
  }

  // We define these in the outer scope to allow communication between 
  // the draggable and droppable directives.
  var draggable = null, offsetLeft = null, offsetTop = null, originX = null, originY = null;

  // Keeps the offset positions of all widgets
  var positions = {}; 
  
  // We need to know when the hovered widget changes so we keep references to the last ones
  var hoveredColumn = null, hoveredWidget = null;

  // The placeholder
  var placeholder = document.createElement('div');
  placeholder.className = 'widgetbox-placeholder';
  
  /**
   * Goes through all the columns and widgets records their positions
   * relative to the window. The result looks like this:
   *
   *   positions = [{
   *     left: 100, 
   *     right: 400, 
   *     segments: [{
   *       top: 50, 
   *       bottom: 150, 
   *       widget: widget_el, 
   *       column: column_el
   *     }, ... ]
   *   }, ... ]
   *
  **/
  function calcPositions(draggable, columnClass, widgetClass){
    // Reset the positions dict
    positions = [];

    // Get all the columns 
    var rect, top, pos, column, columns = document.querySelectorAll(columnClass);
    var wrect, widget, widgets, midpoint;

    for(i=0, ii=columns.length; i<ii; ++i){
      column = columns[i];
      rect   = column.getBoundingClientRect();
      
      positions.push(pos = { 
        left:   round(rect.left + document.body.scrollLeft),
        right:  round(rect.left + document.body.scrollLeft + column.offsetWidth),
        segments: []
      });

      widgets = column.querySelectorAll(widgetClass);
      top = rect.top;
      
      for(j=0, jj=widgets.length; j<jj; ++j){
        widget = widgets[j];

        if(draggable === widget) continue;

        wrect = widget.getBoundingClientRect();
        midpoint = round(wrect.top + document.body.scrollTop + widget.offsetHeight / 2);
        pos.segments.push({ top: top, bottom: midpoint, widget: widget, column: column });
        top = midpoint;
      }
      
      pos.segments.push({ top: top, bottom: rect.bottom, widget: null, column: column });
      pos.segments.sort(function(a,b){ return a.top > b.top ? 1 : a.top < b.top ? -1 : 0; });
    }
    positions.sort(function(a,b){ return a.left > b.left ? 1 : a.left < b.left ? -1 : 0;  });
  }

  /**
   * Angular Widgetbox module definition
   * TODO: MAKE THIS WORK WITH MULTIPLE INSTANCES WITH DIFFERENT CLASS NAMES.
  **/
  angular.module('widgetbox', [])
  
  // Simple service for passing data between directives
  // Because I don't know a simpler way to communicate
  .factory('widgetboxDataService', function(){
    return {};
  })

  // The widgetbox-column directive makes receptacles for our widgets
  .directive('widgetboxColumn', ['$parse', 'widgetboxDataService', function($parse, widgetboxDataService){
    var classes = widgetboxDataService.classes = {};
    
    return function(scope, element, attrs){
      classes.column = "." + attrs.widgetboxColumn;

      element.bind('mousemove', function(e){
        if(!draggable) return;
        var pos, seg, segment = null;
        var x = e.pageX; 
        var y = e.pageY;
        var i = 0, j = 0;

        foundSegment:
        while(pos = positions[i++]){
          // Find the currently hovered column
          if(x >= pos.left && x <= pos.right){
            // Find the currently hovered widget
            j = 0;
            while(seg = pos.segments[j++]){
              if(y >= seg.top && y <= seg.bottom){
                segment = seg;
                break foundSegment;
              }
            }
          }
        }

        if(!segment || (segment.widget === hoveredWidget && segment.column === hoveredColumn)){
          return; // Nothing happens, we're still hovering above the same widget
        }

        hoveredWidget = segment.widget;
        hoveredColumn = segment.column;

        placeholder.parentNode && placeholder.parentNode.removeChild(placeholder);
        
        if(hoveredWidget) {
          hoveredWidget.parentNode.insertBefore(placeholder, hoveredWidget);
        }
        else {
          hoveredColumn.appendChild(placeholder);
        }

        calcPositions(draggable, classes.column, classes.widget);
      });

      element.bind('mouseleave', function(e){
        // Whenever you leave, detach the placeholder from the dom
        placeholder.parentNode && placeholder.parentNode.removeChild(placeholder);
        hoveredWidget = hoveredColumn = null;
      });
    }
  }])
  
  .directive('widgetboxWidget', ['$parse', '$timeout', 'widgetboxDataService', function($parse, $timeout, widgetboxDataService){
    var callbackFunc, classes = widgetboxDataService.classes;

    document.addEventListener('mousemove', function(e){
      if(!draggable) return;
      
      // Move the dragged element
      draggable.style.top  = (offsetTop - originY + e.pageY) + 'px';
      draggable.style.left = (offsetLeft - originX + e.pageX) + 'px';
    });

    document.addEventListener('mouseup', function (e){
      if(!draggable) return;

      // Detach the placeholder from the DOM
      placeholder.parentNode && placeholder.parentNode.removeChild(placeholder);
      
      // This will inform the parent controller
      callbackFunc();
      
      // Reset all state
      draggableClearCSS(draggable);
      hoveredWidget = hoveredColumn = draggable = offsetLeft = offsetTop = originX = originY = null;
    });

    // If only a function is returned, it will be used as the link function
    // and the "restrict" option will automatically be se to "A"
    return function(scope, element, attrs){
      classes.widget = "." + attrs.widgetboxWidget;
      var handleSelector = attrs.widgetboxDraghandle.replace(/^\s+|\s+$/, '');
      var handle = handleSelector ? angular.element(element[0].querySelector(handleSelector)) : element;
      var ctrlCallback = scope.widgetboxOnWidgetMove;
      
      callbackFunc = function(){
        var sourceColumn = draggable.parentNode.getAttribute('widgetbox-column-id');
        var sourcePosition = draggable.getAttribute('widgetbox-widget-id');
        var targetColumn = hoveredColumn && hoveredColumn.getAttribute('widgetbox-column-id');
        var targetPosition = hoveredWidget ? hoveredWidget.getAttribute('widgetbox-widget-id') : 'last';

        ctrlCallback && ctrlCallback(sourceColumn, sourcePosition, targetColumn, targetPosition);
      }

      // Dragging starts
      handle.bind('mousedown', function(e){
        // Respond only to left clicks
        if(e.button || handle[0] !== e.target) {
          return;
        }

        var node = element[0];
        e.preventDefault();

        draggable  = node;
        offsetLeft = node.offsetLeft;
        offsetTop  = node.offsetTop;
        originX    = e.pageX;
        originY    = e.pageY;

        draggableSetCSS(node);
        node.style.top = offsetTop + 'px';
        node.style.left = offsetLeft + 'px';

        // We delay the position calculations to allow for any other widgets
        // to move around after we set position of the draggable to "absolute"
        $timeout(function(){ 
          calcPositions(draggable, classes.column, classes.widget); 
        });
      });
    }
  }]);

})();