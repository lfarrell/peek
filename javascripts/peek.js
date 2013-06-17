function Peek(element) {
  this.element = $(element).get(0);
  this.columns = [];
  this.queue = [];
  this.inprogress = 0;
  this.initial = true;
}

Peek.prototype.start = function(images) {
  
  // fisher-yates shuffle (in-place, returns reference)
  
  function shuffle(a) {
    for (var i = a.length - 2; i > 0; i--) {
      var j = Math.floor(Math.random() * i);
      var t = a[j];
      a[j] = a[i];
      a[i] = t;
    }
    return a;
  }
  
  this.images = shuffle(images);
  
  $(window).on("resize", _.debounce(_.bind(this.layout, this), 100));
  setInterval(_.bind(this.load, this), 100);
  setInterval(_.bind(this.fill, this), 100);
  setInterval(_.bind(this.shift, this), 4000);
  
  this.layout();
  
}

Peek.prototype.layout = function() {
  
  var columnWidth = 190;
  var parentWidth = $(this.element.parentNode).width();
  
  // Amount of space taken up by left and right columns
  
  var partialSpace = Math.ceil((parentWidth - columnWidth) / 2);
  
  // How many columns we want
  
  var partialCount = Math.ceil(partialSpace / columnWidth);
  var count = 1 + (partialCount * 2);
  
  // If there are no columns, add a center column
  
  var addedCenter = false;
  
  if (this.columns.length == 0) {
    var column = new Column();
    column.delegate = this;
    
    this.columns.push(column);
    this.element.appendChild(column.$element[0]);
    
    addedCenter = true;
  }
  
  // How many columns do we currently have?
  
  var currentPartialCount = Math.ceil((this.columns.length - 1) / 2);
  
  // Add columns if we don't have enough, remove columns if we have too many
  
  // FIXME: It may be that filling columns is more costly than just keeping them onscreen -- so we could try never removing columns and only filling/shifting those onscreen.
  
  if (currentPartialCount < partialCount) {
    _.times(partialCount - currentPartialCount, _.bind(function() {
      var column;
      
      column = new Column();
      column.delegate = this;
      this.columns.unshift(column);
      this.element.insertBefore(column.$element[0], this.element.firstChild);
      
      column = new Column();
      column.delegate = this;
      this.columns.push(column);
      this.element.appendChild(column.$element[0]);
    }, this));
  } else if (currentPartialCount > partialCount) {
    _.times(currentPartialCount - partialCount, _.bind(function() {
      var column;
      
      column = this.columns.shift(column);
      this.images = this.images.concat(_.pluck(column.items, "spec"));
      this.element.removeChild(column.$element[0]);
      
      column = this.columns.pop(column);
      this.images = this.images.concat(_.pluck(column.items, "spec"));
      this.element.removeChild(column.$element[0]);
    }, this));
  }
  
  // Set position of columns if counts changed
  
  if (addedCenter || currentPartialCount != partialCount) {
    for (var i = 0; i < this.columns.length; i++) {
      this.columns[i].$element[0].style.left = (i * columnWidth) + "px";
    }
  
    this.element.style.width = (columnWidth * count) + "px"
    this.element.style.marginLeft = -Math.round((columnWidth * count) / 2) + "px";
  }
  
}

Peek.prototype.load = function() {
  
  // If we have enough items, don't load any more right now.
  
  var height = _.reduce(this.queue, function(h, i) { return h + i.getHeight(); }, 0);
  
  // Can we fill the needed height?
  
  var needed = _.reduce(this.columns, function(h, c) { return Math.max(0, c.getNeededHeight()); }, 0);
  
  if (height > needed) {
    return;
  }
  
  // Don't load more than 10 at a time.
  
  var count = Math.max(10 - this.inprogress, 0);
  
  _.times(count, _.bind(function() {
    
    var spec = this.images.shift();
    
    if (spec) {
    
      // Add completed items to the queue. Ignore errors.
    
      Item.get(
        spec,
        _.bind(function(item) { this.queue.push(item); this.inprogress--; }, this),
        _.bind(function() { this.inprogress--; }, this)
      );
    
      this.inprogress++;
      
    }
    
  }, this));
   
}

Peek.prototype.fill = function() {
  
  while (this.queue.length > 0 && _.any(this.columns, function(c) { return c.getFreeHeight() > 0; })) {
    
    var column = _.max(this.columns, function(c) { return c.getFreeHeight(); });
    column.push(this.queue.shift());
    
  }
   
}

Peek.prototype.didRemoveItems = function(items) {
  
  this.images = this.images.concat(_.pluck(items, "spec"));
  
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
  
  this.$element = $("<div class=\"column\"></div>");
  this.items = [];
  this.dragging = false;
  this.hover = false;
  
  this.$element.on("mousedown", _.bind(this.dragStart, this));
  $(window).on("mousemove", _.bind(this.dragMove, this));
  $(window).on("mouseup", _.bind(this.dragEnd, this));
  this.$element.on("click", _.bind(this.onClick, this));
  
  this.$element.on("mouseover", _.bind(this.hoverStart, this));
  this.$element.on("mouseout", _.bind(this.hoverEnd, this));
  
}

Column.prototype.getFreeHeight = function() {
  
  if (this.items.length == 0) {
    return this.getHeight();
  } else {
    return this.getHeight() - (this.getItemMeasurements(this.items.length - 1).bottom + this.getOffset());
  }
  
}

Column.prototype.getNeededHeight = function() {
  
  if (this.items.length == 0) {
    return this.getHeight();
  } else {
    return this.getFreeHeight() + this.items[0].getHeight();
  }
  
}

Column.prototype.canShift = function() {
  
  return this.items.length > 0 && !this.dragging && this.getFreeHeight() < 0 && !this.hover;
  
}

Column.prototype.setOffset = function(offset) {
  
  this.$element.css({ marginTop: offset + "px" });
  
}

Column.prototype.getOffset = function() {
  
  return parseInt(this.$element.css("marginTop"));
  
}

Column.prototype.getHeight = function() {
  
  return this.$element.height();
  
}

Column.prototype.prune = function(count) {

  if (count < 0 || count > this.items.length) {
    throw "Prune count out of bounds";
  }

  var offset = this.getOffset();
  var pruned = this.items.splice(0, count);

  for (var i = 0; i < pruned.length; i++) {
    pruned[i].$element.remove();
    offset += pruned[i].getHeight();
  }

  this.setOffset(offset);
  
  if (this.delegate) {
    this.delegate.didRemoveItems(pruned);
  }

}

Column.prototype.getItemMeasurements = function(index) {

  if (index < 0 || index > this.items.length - 1) {
    throw "Measurement index out of bounds";
  }

  var top = 0, bottom = this.items[0].getHeight();

  for (var i = 0; i < index; i++) {
    var height = this.items[i].getHeight();
    top += height;
    bottom += height;
  }

  return {
    top: top,
    bottom: bottom,
    middle: top + ((bottom - top) / 2)
  };

}

Column.prototype.setLayout = function(layout) {

  // Stop animations

  this.$element.stop();

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
    this.$element.animate({ marginTop: offset + "px" }, { complete: prune, duration: 1000 });
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
  
  this.$element.stop();
  
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
    
    // If the bottom item's bottom is above the bottom of the column, snap the column's bottom to that item. Find the first item with its bottom onscreen and prune, leaving 2 items above that item.
    
    if (bottom + offset <= height) {
      for (var i = 0; i < this.items.length; i++) {
        if (bottom - this.getItemMeasurements(i).bottom < height) {
          break;
        }
      }
      
      this.setLayout({ bottom: this.items.length - 1, prune: Math.max(0, i - 2) });
      
      return;
    }
    
    // Otherwise, find the first item which is more than 50% onscreen, and snap the top to that item. Prune, leaving 2 items above that item.
    
    for (var i = 0; i < this.items.length; i++) {
      if (this.getItemMeasurements(i).middle + offset > 0) {
        this.setLayout({ top: i, prune: Math.max(0, i - 2) });
        return;
      }
    }
    
  }
  
}

Column.prototype.push = function(item) {
  
  this.items.push(item);
  item.$element.appendTo(this.$element).css({ opacity: 0 }).animate({ opacity: 1 });
  
}

Column.prototype.shift = function() {
  
  if (this.items.length > 0 && !this.dragging) {
    
    // Find the first item which is more than 50% onscreen, snap the top to the next item (if there is one), and prune, leaving two items above the one that is 50% onscreen.
    
    var offset = this.getOffset();
    
    for (var i = 0; i < this.items.length; i++) {
      if (this.getItemMeasurements(i).middle + offset > 0) {
        this.setLayout({ top: Math.min(i + 1, this.items.length - 1), prune: Math.max(0, (i + 1) - 2) });
        break;
      }
    }
    
  }
  
}


var Item = function(image, spec) {
  
  this.image = image;
  this.spec = spec;
  
  this.$element = $(_.template(Item.template, spec, { variable: "spec" }));
  this.$element.find(".image").append(this.image);
  
}

Item.template = "<div class=\"item\"> \
  <a href=\"https://cdr.lib.unc.edu/record?id=<%= spec.pid %>\"> \
    <div class=\"image\"></div> \
    <div class=\"description\"> \
      <div class=\"title\"><%= spec.title %></div> \
      <% if (spec.creators.length > 0) { %><div class=\"other\"><%= spec.creators.join(\"; \") %></div><% } %> \
      <% if (spec.collection) { %><div class=\"other\"><%= spec.collection %></div><% } %> \
    </div> \
  </a> \
</div>";

Item.get = function(spec, complete, error) {
  
  var img = document.createElement("img");
  
  img.addEventListener("load", function() {
    complete(new Item(img, spec));
  }, false);
  
  img.addEventListener("error", function() {
    error();
  }, false);
  
  img.src = Item.base_path + spec.path;
  
}

Item.prototype.getHeight = function() {
  
  return Math.ceil((this.image.height / this.image.width) * 185) + 5;
  
}
