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

Peek.prototype.didRemoveItems = function(items) {
  
  this.add(_.pluck(items, "item"));
  
}

Peek.prototype.layout = function() {
  
  // Amount of space taken up by left and right columns
  
  var parentWidth = this.$element.width();
  var partialSpace = Math.max(0, Math.ceil((parentWidth - this.columnWidth) / 2));
  
  // How many columns we want, always with one center column
  
  var partialCount = Math.ceil(partialSpace / this.columnWidth);
  var count = 1 + (partialCount * 2);
  
  // Add and remove, and reposition
  
  if (this.columns.length != count) {
  
    // Add columns if we don't have enough
  
    while (this.columns.length < count) {
    
      var column;
    
      column = new Column();
      column.delegate = this;
      column.$element.css("width", this.columnWidth + "px");
    
      if (this.columns.length % 2 == 0) {
        this.columns.unshift(column);
        this.$columns[0].insertBefore(column.$element[0], this.$columns[0].firstChild);
      } else {
        this.columns.push(column);
        this.$columns[0].appendChild(column.$element[0]);
      }
    
    }
  
    // Remove columns if we have too many
  
    while (this.columns.length > count) {
    
      var column;
    
      if (this.columns.length % 2 == 0) {
        column = this.columns.shift();
      } else {
        column = this.columns.pop();
      }
    
      this.didRemoveItems(column.items);
      this.$columns[0].removeChild(column.$element[0]);
    
    }
    
    // Adjust positioning

    for (var i = 0; i < this.columns.length; i++) {
      this.columns[i].$element.css("left", (i * this.columnWidth) + "px");
    }
  
    this.$columns.css("width", (this.columnWidth * count) + "px");
    this.$columns.css("marginLeft", -Math.round((this.columnWidth * count) / 2) + "px");
    
  }
  
}

Peek.prototype.loadItem = function(item) {
  
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

Peek.prototype.load = function() {
  
  // If we have ready items, don't load any.
  
  if (this.ready.length > 0) {
    return;
  }
  
  // Ensure that we aren't loading more than 10 items at a time.
  
  var count = Math.max(10 - this.inprogress, 0);
  
  for (var i = 0; i < count; i++) {
    var item = this.items.shift();
    
    if (item) {
      this.loadItem(item);
    } else {
      break;
    }
  }
   
}

Peek.prototype.fill = function() {
  
  while (this.ready.length > 0 && _.any(this.columns, function(c) { return c.getFreeHeight() > 0; })) {
    
    var column = _.max(this.columns, function(c) { return c.getFreeHeight(); });
    column.push(this.ready.shift());
    
  }
   
}

Peek.prototype.shift = function() {
  
  var shiftable = _.filter(this.columns, function(c) { return c.canShift(); });
  
  if (shiftable.length == 0) {
    return;
  }
  
  var column = shiftable[Math.floor(Math.random() * shiftable.length  )];
  
  column.shift();
   
}
