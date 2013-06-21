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
