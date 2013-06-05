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
  setInterval(_.bind(this.update, this), 1000);
  
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
    this.columns.push(column);
    this.element.appendChild(column.element);
    
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
      this.columns.unshift(column);
      this.element.insertBefore(column.element, this.element.firstChild);
      
      column = new Column();
      this.columns.push(column);
      this.element.appendChild(column.element);
    }, this));
  } else if (currentPartialCount > partialCount) {
    _.times(currentPartialCount - partialCount, _.bind(function() {
      var column;
      
      column = this.columns.shift(column);
      this.images = this.images.concat(_.pluck(column.items, "spec"));
      this.element.removeChild(column.element);
      
      column = this.columns.pop(column);
      this.images = this.images.concat(_.pluck(column.items, "spec"));
      this.element.removeChild(column.element);
    }, this));
  }
  
  // Set position of columns if counts changed
  
  if (addedCenter || currentPartialCount != partialCount) {
    for (var i = 0; i < this.columns.length; i++) {
      this.columns[i].element.style.left = (i * columnWidth) + "px";
    }
  
    this.element.style.width = (columnWidth * count) + "px"
    this.element.style.marginLeft = -Math.round((columnWidth * count) / 2) + "px";
  }
  
}

Peek.prototype.load = function() {
  
  // If we have enough items, don't load any more right now.
  
  var height = _.reduce(this.queue, function(h, i) { return h + i.getHeight(); }, 0);
  
  // Can we fill the unfilled height?
  
  var unfilled = _.reduce(this.columns, function(h, c) { return Math.max(0, c.getUnfilledHeight()); }, 0);
  
  if (height > unfilled) {
    return;
  }
  
  // Do we have enough height to shift?
  
  // FIXME: Sometimes we should be able to shift if there isn't anything in the queue -- there might already be enough filled space in a given column to make up for the space lost by the top item.

  var maxTopHeight = _.max(_.invoke(this.columns, "getTopHeight"));
  
  if (height > maxTopHeight) {
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
  
  while (this.queue.length > 0 && _.any(this.columns, function(c) { return c.getUnfilledHeight() > 0; })) {
    
    var column = _.max(this.columns, function(c) { return c.getUnfilledHeight(); });
    column.push(this.queue.shift());
    
  }
   
}

Peek.prototype.shift = function() {
  
  if (_.any(this.columns, function(c) { return c.getUnfilledHeight() > 0; })) {
    return;
  }
  
  var shiftable = _.filter(this.columns, _.bind(function(c) { return c != this.hover; }, this));
  
  if (shiftable.length == 0) {
    return;
  }
  
  var column = shiftable[Math.floor(Math.random() * shiftable.length  )];
  
  var item = column.shift();
  
  if (item) {
    this.images.push(item.spec);
  }
  
  while (this.queue.length > 0 && column.getUnfilledHeight() > 0) {
    column.push(this.queue.shift());
  }
  
  this.initial = false;
   
}

Peek.prototype.update = function() {
  
  _.invoke(this.columns, "update", this.initial);
   
}


var Column = function() {
  this.element = $("<div class=\"column\"></div>").get(0);
  
  this.items = [];
  this.top = 0;
  this.bottom = 0;
  
  this.offset = -(20 + Math.floor(Math.random() * 100));
  $(this.element).css({ "margin-top": this.offset });
}

Column.prototype.getTopHeight = function() {
  return this.items[this.top] ? this.items[this.top].getHeight() - this.offset : 0;
}

Column.prototype.getUnfilledHeight = function() {
  return (($(this.element).height() - this.offset) - _.reduce(this.items.slice(this.top), function(h, i) { return h + i.getHeight(); }, 0));
}

Column.prototype.push = function(item) {
  this.items.push(item);
}

Column.prototype.shift = function() {
  var item = this.items[this.top];
  
  this.top = Math.min(this.top + 1, this.items.length);
  this.bottom = Math.max(this.bottom, this.top);
  
  return item;
}

Column.prototype.update = function(isInitialLoad) {
  
  var top;
  
  var existing = this.items.slice(0, this.bottom);
  var added = this.items.slice(this.bottom);
  var removed = this.items.splice(0, this.top);
  
  this.top = 0;
  this.bottom = this.items.length;

  // Append added items to the element

  _.each(added, _.bind(function(item) {
    this.element.appendChild(item.element);
  }, this));

  // If there were removed items, slide column so that removed items are out of view, removing them from the document when the transition finishes.
  
  if (removed.length > 0) {
    
    var height = _.reduce(removed, function(h, i) { return h + i.getHeight(); }, 0);
    
    $(this.element).animate({ "margin-top": (this.offset - height) + "px" }, 1000, $.bez([0.25, 0.1, 0.25, 1]), _.bind(function() {
      
      _.each(removed, _.bind(function(item) {
        if (item.element.parentNode) {
          $(item.element).remove();
        }
      }, this));
      
      $(this.element).css({ "margin-top": this.offset });
      
    }, this));
    
  }
  
  // Animate opacity of added items
  
  _.each(added, _.bind(function(item) {
    item.element.style.opacity = "0";
    $(item.element).animate({ opacity: 1 }, 500);
  }, this));
  
}


var Item = function(image, spec) {
  
  this.image = image;
  this.spec = spec;
  
  this.element = $("<div class=\"item\" title=\"" + this.spec.title + "\"><a href=\"https://cdr.lib.unc.edu/record?id=" + this.spec.pid + "\"></a></div>").get(0);
  $(this.element).find("a").append(this.image);
  
}

Item.get = function(spec, complete, error) {
  
  var img = document.createElement("img");
  
  img.addEventListener("load", function() {
    complete(new Item(img, spec));
  }, false);
  
  img.addEventListener("error", function() {
    error();
  }, false);
  
  img.src = "thumbnails/" + spec.path;
  
}

Item.prototype.getHeight = function() {
  
  return Math.ceil((this.image.height / this.image.width) * 185) + 5;
  
}
