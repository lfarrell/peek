function Peek(element, template, columnWidth) {
  
  this.$element = $(element);
  this.element = this.$element[0];
  
  this.$container = $("<div class=\"peek-container\"></div>").appendTo(this.$element);
  this.$columns = $("<div class=\"peek-columns\"></div>").appendTo(this.$container);
  
  this.template = template;
  this.columnWidth = columnWidth;
  
  this.columns = [];
  this.items = [];
  this.ready = [];
  this.inprogress = 0;
  
}

Peek.prototype.add = function(items) {
  
  this.items = this.items.concat(items);
  
}

Peek.prototype.start = function() {
  
  $(window).on("resize", _.debounce(_.bind(this.layout, this), 100));
  setInterval(_.bind(this.load, this), 100);
  setInterval(_.bind(this.fill, this), 100);
  setInterval(_.bind(this.shift, this), 4000);
  
  this.layout();
  
}

Peek.prototype.layout = function() {
  
  // If there are no columns, add a center column
  
  var addedCenter = false;
  
  if (this.columns.length == 0) {
    
    var column = new Column();
    column.delegate = this;
    
    this.columns.push(column);
    this.$columns[0].appendChild(column.$element[0]);
    
    addedCenter = true;
    
  }
  
  var parentWidth = this.$element.width();
  
  // Amount of space taken up by left and right columns
  
  var partialSpace = Math.ceil((parentWidth - this.columnWidth) / 2);
  
  // How many columns we want
  
  var partialCount = Math.ceil(partialSpace / this.columnWidth);
  var count = 1 + (partialCount * 2);
  
  // How many columns do we currently have?
  
  var currentPartialCount = Math.ceil((this.columns.length - 1) / 2);
  
  // Add columns if we don't have enough, remove columns if we have too many
  
  if (currentPartialCount < partialCount) {
    _.times(partialCount - currentPartialCount, _.bind(function() {
      var column;
      
      column = new Column();
      column.delegate = this;
      this.columns.unshift(column);
      this.$columns[0].insertBefore(column.$element[0], this.$columns[0].firstChild);
      column.$element[0].style.width = this.columnWidth + "px";
      
      column = new Column();
      column.delegate = this;
      this.columns.push(column);
      this.$columns[0].appendChild(column.$element[0]);
      column.$element[0].style.width = this.columnWidth + "px";
    }, this));
  } else if (currentPartialCount > partialCount) {
    _.times(currentPartialCount - partialCount, _.bind(function() {
      var column;
      
      column = this.columns.shift(column);
      this.didRemoveItems(column.items);
      this.$columns[0].removeChild(column.$element[0]);
      
      column = this.columns.pop(column);
      this.didRemoveItems(column.items);
      this.$columns[0].removeChild(column.$element[0]);
    }, this));
  }
  
  // Set position of columns if counts changed
  
  if (addedCenter || currentPartialCount != partialCount) {
    for (var i = 0; i < this.columns.length; i++) {
      this.columns[i].$element[0].style.left = (i * this.columnWidth) + "px";
    }
  
    this.$columns[0].style.width = (this.columnWidth * count) + "px"
    this.$columns[0].style.marginLeft = -Math.round((this.columnWidth * count) / 2) + "px";
  }
  
}

Peek.prototype.load = function() {
  
  // If we have enough items, don't load any more right now.
  
  var height = _.reduce(this.ready, _.bind(function(sum, item) {
    var image = item.$element.find("img")[0];
    return sum + (this.columnWidth * (image.height / image.width));
  }, this), 0);
  
  // Can we fill the needed height?
  
  var needed = _.reduce(this.columns, function(h, c) { return Math.max(0, c.getNeededHeight()); }, 0);
  
  if (height > needed) {
    return;
  }
  
  // Don't load more than 10 at a time.
  
  var count = Math.max(10 - this.inprogress, 0);
  
  _.times(count, _.bind(function() {
    
    var item = this.items.shift();
    
    if (item) {
      
      // Add completed items to the ready list. Ignore errors.
      
      var $element = $(this.template(item).trim());
      var image = $element.find("img").eq(0);
      
      if (image) {
        
        image.on("load", _.bind(function() {
          this.ready.push({ item: item, $element: $element });
          this.inprogress--;
        }, this));

        image.on("error", _.bind(function() {
          this.inprogress--;
        }, this));
    
        this.inprogress++;
        
      } else {
        
        throw "Couldn't retrieve image for evaluated item template";
        
      }
      
    }
    
  }, this));
   
}

Peek.prototype.fill = function() {
  
  while (this.ready.length > 0 && _.any(this.columns, function(c) { return c.getFreeHeight() > 0; })) {
    
    var column = _.max(this.columns, function(c) { return c.getFreeHeight(); });
    column.push(this.ready.shift());
    
  }
   
}

Peek.prototype.didRemoveItems = function(items) {
  
  this.add(_.pluck(items, "item"));
  
}

Peek.prototype.shift = function() {
  
  var shiftable = _.filter(this.columns, function(c) { return c.canShift(); });
  
  if (shiftable.length == 0) {
    return;
  }
  
  var column = shiftable[Math.floor(Math.random() * shiftable.length  )];
  
  column.shift();
   
}


function Column() {
  
  this.$element = $("<div class=\"peek-column\"></div>");
  this.$inner = $("<div class=\"peek-column-inner\"></div>").appendTo(this.$element);
  
  this.items = [];
  this.dragging = false;
  this.hover = false;
  
  this.nudge = -Math.floor(Math.random() * 100);
  
  this.$element.on("mousedown", _.bind(this.dragStart, this));
  $(window).on("mousemove", _.bind(this.dragMove, this));
  $(window).on("mouseup", _.bind(this.dragEnd, this));
  this.$element.on("click", _.bind(this.onClick, this));
  
  this.$element.on("mouseover", _.bind(this.hoverStart, this));
  this.$element.on("mouseout", _.bind(this.hoverEnd, this));
  
  this.setOffset(0);
  
}

Column.prototype.getFreeHeight = function() {
  
  if (this.items.length == 0) {
    return this.getHeight();
  } else {
    return (this.getHeight() - this.getOffset()) - this.getItemMeasurements(this.items.length - 1).bottom;
  }
  
}

Column.prototype.getNeededHeight = function() {
  
  if (this.items.length == 0) {
    return this.getHeight();
  } else {
    return this.getFreeHeight() + this.items[0].$element.outerHeight();
  }
  
}

Column.prototype.canShift = function() {
  
  return this.items.length > 0 && !this.dragging && this.getFreeHeight() < 0 && !this.hover;
  
}

Column.prototype.setOffset = function(offset) {
  
  this.$inner.css({ marginTop: offset + this.nudge + "px" });
  
}

Column.prototype.getOffset = function() {
  
  return parseInt(this.$inner.css("marginTop")) - this.nudge;
  
}

Column.prototype.getHeight = function() {
  
  return this.$element.height() - this.nudge;
  
}

Column.prototype.prune = function(count) {

  if (count < 0 || count > this.items.length) {
    throw "Prune count out of bounds";
  }

  var offset = this.getOffset();
  var pruned = this.items.splice(0, count);

  for (var i = 0; i < pruned.length; i++) {
    offset += pruned[i].$element.outerHeight();
    pruned[i].$element.remove();
  }

  this.setOffset(offset);
  
  if (this.delegate) {
    this.delegate.didRemoveItems(pruned);
  }

}

// Get measurements for the item at index relative to the top of the .column-inner element.

Column.prototype.getItemMeasurements = function(index) {

  if (index < 0 || index > this.items.length - 1) {
    throw "Measurement index out of bounds";
  }
  
  var position = this.items[index].$element.position();
  var height = this.items[index].$element.outerHeight();
  var offset = this.getOffset() + this.nudge;
  
  return {
    top: position.top - offset,
    bottom: (position.top - offset) + height,
    middle: (position.top - offset) + (height / 2)
  };

}

Column.prototype.setLayout = function(layout) {

  // Stop animations

  this.$inner.stop();

  // Animate, prune on completion
  
  var prune, offset;

  if (layout.prune) {
    prune = (function(context, count) { return function() { context.prune(count); } })(this, layout.prune);
  }

  if (typeof layout.top !== "undefined") {
    offset = -this.getItemMeasurements(layout.top).top;
  } else if (typeof layout.bottom !== "undefined") {
    offset = this.getHeight() - this.getItemMeasurements(layout.bottom).bottom;
  }

  if (typeof offset !== "undefined") {
    this.$inner.animate({ marginTop: offset + this.nudge + "px" }, { complete: prune, duration: 1000 });
  } else if (typeof prune !== "undefined") {
    prune.call();
  }

}

Column.prototype.hoverStart = function(e) {
  
  this.hover = true;
  
}

Column.prototype.hoverEnd = function(e) {
  
  this.hover = false;
  
}

Column.prototype.dragStart = function(e) {
  
  e.preventDefault();
  
  // Stop animations
  
  this.$inner.stop();
  
  // Find the drag offset
  
  this.dragOffset = this.getOffset() - e.pageY;
  this.initialDragPosition = e.pageY;
  
  // Start dragging
  
  this.dragging = true;
    
  this.dragMoved = false;
  
}

Column.prototype.dragMove = function(e) {
  
  if (this.dragging) {
  
    e.preventDefault();
    
    this.dragMoved = true;
    
    this.setOffset(this.dragOffset + e.pageY);
    
  }
  
}

Column.prototype.onClick = function(e) {
  
  if (this.dragMoved) {
    e.preventDefault();
  }
  
}

Column.prototype.dragEnd = function(e) {
  
  if (this.dragging) {
    
    e.preventDefault();
    
    this.dragging = false;
    
    // Release
    
    // If there aren't any items
    
    if (this.items.length == 0) {
      this.setLayout({ top: 0 });
      return;
    }
    
    // If the top item is below the top of the column
    
    var offset = this.getOffset();
    
    if (offset > 0) {
      this.setLayout({ top: 0 });
      return;
    }
    
    // If there aren't any items overflowing the column
    
    var height = this.getHeight();
    var bottom = this.getItemMeasurements(this.items.length - 1).bottom;
    
    if (bottom <= height) {
      this.setLayout({ top: 0 });
      return;
    }
    
    // If the bottom item's bottom is above the bottom of the column, snap the column's bottom to that item. Find the first item with its bottom onscreen and prune.
    
    if (bottom + offset <= height) {
      for (var i = 0; i < this.items.length; i++) {
        if (bottom - this.getItemMeasurements(i).bottom < height) {
          break;
        }
      }
      
      this.setLayout({ bottom: this.items.length - 1, prune: Math.max(0, i) });
      
      return;
    }
    
  }
  
}

Column.prototype.push = function(item) {
  
  this.items.push(item);
  item.$element.appendTo(this.$inner).css({ opacity: 0 }).animate({ opacity: 1 });
  
}

Column.prototype.shift = function() {
  
  if (this.items.length > 0 && !this.dragging) {
    
    // Find the first item which is more than 50% onscreen, snap the top to the next item (if there is one), and prune.
    
    var offset = this.getOffset();
    
    for (var i = 0; i < this.items.length; i++) {
      if (this.getItemMeasurements(i).middle + offset > 0) {
        this.setLayout({ top: Math.min(i + 1, this.items.length - 1), prune: Math.max(0, i + 1) });
        break;
      }
    }
    
  }
  
}
