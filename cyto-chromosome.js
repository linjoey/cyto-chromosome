
(function(cyto_chr, d3) {

  cyto_chr.margin = {
    top: 35,
    left: 14,
    right: 5
  };

  var CHR_HEIGHT = 15;
  var CHR1_BP_END = 248956422;
  var CHR1_BP_MID = 121700000;

  var Chromosome = function() {
    //TODO FIX ALIGN AXIS AS WELL WHEN CENTERING CENTROMERE

    this._segment = "1";
    this._domTarget = d3.select(document.documentElement);
    this._resolution = "550";
    this._width = 1000;
    this._svgHeight = 75;
    this._useRelative = true;
    this._showAxis = false;
    this.dispatch = d3.dispatch('bandclick', 'selectorchange');
    this.rendered = false;

    this.selectors = [];
  };

  Chromosome.prototype.segment = function (a) {
    if (typeof a === 'number') a = a.toString();
    return cyto_chr.InitGetterSetter.call(this, '_segment', a);
  };

  Chromosome.prototype.target = function (a) {
    if(typeof a === 'string') a = d3.select(a);
    if(a.empty()) {
      throw "Error: Invalid dom target";
    }
    return cyto_chr.InitGetterSetter.call(this, '_domTarget', a);
  };

  Chromosome.prototype.resolution = function (a) {
    if (typeof a === 'number') a = a.toString();
    return cyto_chr.InitGetterSetter.call(this, '_resolution', a);
  };

  Chromosome.prototype.width = function (a) {
    return cyto_chr.InitGetterSetter.call(this, '_width', a);
  };

  Chromosome.prototype.useRelative = function (a) {
    return cyto_chr.InitGetterSetter.call(this, '_useRelative', a);
  };

  Chromosome.prototype.showAxis = function (a) {
    return cyto_chr.InitGetterSetter.call(this, '_showAxis', a);
  };

  Chromosome.prototype.on = function(e, listener) {
    if (!this.dispatch.hasOwnProperty(e)) throw "Error: No event for " + e;

    this.dispatch.on(e, listener);
  };

  Chromosome.prototype.config = function(type, arg) {
    var p = '_' + type;
    return cyto_chr.InitGetterSetter.call(this, p, arg);
  };

  Chromosome.prototype.renderAxis = function () {
    var bpAxis = d3.svg.axis()
      .scale(this.xscale)
      .tickFormat(d3.format('s'))
      .orient("bottom");

    if (this._useRelative && (this._segment === "Y" || this._segment === "22" || this._segment === "21" || this._segment === "20" || this._segment === "19")) {
      bpAxis.ticks(6);
    }

    var axisg = this.svgTarget.append('g')
      .classed('bp-axis', true)
      .attr('transform', 'translate('+ cyto_chr.margin.left + ',' + (CHR_HEIGHT + cyto_chr.margin.top + 5) + ")");

      axisg.call(bpAxis);

    axisg.selectAll('text')
      .style('font', '10px sans-serif');

    axisg.selectAll('path, line')
      .style({
        "fill": "none",
        "stroke": "#666666",
        "shape-rendering": "crispEdges"
      });
  };

  Chromosome.prototype.remove = function() {
    this.svgTarget.remove();
  };

  Chromosome.prototype.moveSelectorTo = function(start, stop) {
    if(arguments.length !== 2) {
      throw "Error moveSelectorTo: Invalid number of arguments. Both start and stop coordinates are required";
    }

    if (this.selectors.length === 0) {
      this.newSelector(0, "10000000");
    } else {
      this.selectors[0].move(start, stop);
    }

  };

  Chromosome.prototype.newSelector = function(bp_start, bp_stop) {

    var self = this;
    function selectorRemoveCB(sel) {
      var index = self.selectors.indexOf(sel);
      self.selectors.splice(index, 1);
    }

    var ve = cyto_chr.selector(selectorRemoveCB)
      .x(cyto_chr.margin.left)
      .y(cyto_chr.margin.top - (CHR_HEIGHT / 4))
      .height(CHR_HEIGHT + (CHR_HEIGHT / 2))
      .xscale(this.xscale)
      .extent([bp_start, bp_stop])
      .target(this.svgTarget)
      .render();

    ve.dispatch.on('change', function(d) {
      self.dispatch.selectorchange(d);
    });

    this.selectors.push(ve);
  };

  Chromosome.prototype.getSelections = function() {

    var ret = [];
    for(var i = 0; i < this.selectors.length; i++) {
      var sel = this.selectors[i]['_extent'];
      ret.push({
        start: sel[0],
        stop: sel[1]
      })
    }
    return ret;
  };

  Chromosome.prototype.render = function () {

    var self = this;

    if(self.rendered) {
      self.remove();
    }

    cyto_chr.modelLoader.load(this._segment, this._resolution, function(data) {

      var maxBasePair = d3.max(data, function(d) {
        return +d.bp_stop;
      });

      self.segMid = 0;
      for(var j =0; j < data.length;j++) {
        if(data[j].stain ==="acen") {
          self.segMid = data[j].bp_stop;
          break;
        }
      }

      var rangeTo = self._useRelative ? (maxBasePair / CHR1_BP_END) * self._width : self._width;

      self.xscale = d3.scale.linear()
        .domain([1, maxBasePair])
        .range([0, rangeTo - cyto_chr.margin.left]);

      var svgWidth = self.alignCentromere ? self._width + (self._width * 0.3) : self._width;

      self.svgTarget = self._domTarget.append('svg')
        .attr('width', svgWidth + cyto_chr.margin.right)
        .attr('height', self._svgHeight);

      var bands = self.svgTarget.selectAll('g')
        .data(data).enter();

      cyto_chr.initPattern.call(self.svgTarget);

      self.svgTarget.append('text')
        .text(self._segment)
        .attr('x', 5)
        .attr('y', cyto_chr.margin.top + (CHR_HEIGHT/ 2) + 2)
        .attr('text-anchor','middle')
        .style('font', '10px sans-serif');

      function bpCoord(bp) {
        var xshift = 0;
        if(self.alignCentromere && self._segment !== "1") {
          xshift = self.xscale(CHR1_BP_MID) - self.xscale(self.segMid);
        }

        return self.xscale(bp) + cyto_chr.margin.left + xshift;
      }

      bands.append('g')
        .each(function(d, i) {

          var elem = d3.select(this);

          function applyBorder() {
            this
              .attr('stroke', '#000000')
              .attr('stroke-width', 0.2);
          }

          function drawRoundedRect(d, r, tl, tr, bl, br) {
            return this.append('path')
              .attr("d", cyto_chr.roundedRect(bpCoord(d.bp_start), cyto_chr.margin.top, bpCoord(d.bp_stop) - bpCoord(d.bp_start), CHR_HEIGHT, r, tl, tr, bl, br))
              .style('fill', cyto_chr.getStainColour(d.stain, d.density));
          }

          if(i % 2 === 0) {
            var bmid = (bpCoord(d.bp_stop) + bpCoord(d.bp_start)) / 2;
            elem.append('line')
              .attr('x1', bmid)
              .attr('y1', cyto_chr.margin.top)
              .attr('x2', bmid)
              .attr('y2', cyto_chr.margin.top - 4)
              .style('stroke', 'grey')
              .style('stroke-width',1);

            elem.append('text')
              .attr('transform', 'translate(' + bmid + ',' + (cyto_chr.margin.top - 6) + ')rotate(-50)')
              .style('font', '10px sans-serif')
              .text(d.arm + d.band);
          }

          var rect;
          var w = bpCoord(d.bp_stop) - bpCoord(d.bp_start);
          if (i === 0 && w > 10) {
            rect = drawRoundedRect.call(elem, d, 4, true, false, true, false);
            applyBorder.call(rect);
          } else if (d.stain === "acen" && (w > 6)) {

            if (d.arm === "p") {
              rect = drawRoundedRect.call(elem, d, 8, false, true, false, true);

            } else if(d.arm === "q") {
              rect = drawRoundedRect.call(elem, d, 8, true, false, true, false);
            }
          } else if (i === data.length - 1) {

            rect = drawRoundedRect.call(elem, d, 5, false, true, false, true);
            applyBorder.call(rect);

          } else {

            var ys = d.stain === "stalk" ? cyto_chr.margin.top + (CHR_HEIGHT / 4) : cyto_chr.margin.top;
            var hs = d.stain === "stalk" ? CHR_HEIGHT / 2 : CHR_HEIGHT;
            rect = elem.append('rect')
              .attr('x', bpCoord(d.bp_start))
              .attr('y', ys)
              .attr('height', hs)
              .attr('width', self.xscale(d.bp_stop) - self.xscale(d.bp_start))
              .style('fill', cyto_chr.getStainColour(d.stain, d.density));
            applyBorder.call(rect);
          }

          rect.append('title')
            .text(d.arm + d.band)

          rect.on('mouseover', function(d) {
            var e = d3.select(this)
              .style('opacity', "0.5")
              .style('cursor', 'pointer');

            if (d.stain === "gneg") {
              e.style('fill', cyto_chr.getStainColour("gpos", "25"));
            }

          });

          rect.on('mouseout', function(d) {
            var e = d3.select(this)
              .style('opacity', "1")
              .style('cursor', 'default');

            if (d.stain === "gneg") {
              e.style('fill', cyto_chr.getStainColour("gneg"));
            }
          });

          rect.on('click', function(d) {

            if(self.selectors.length === 0 || d3.event.shiftKey) {
              self.newSelector(d.bp_start, d.bp_stop);
            }
            self.dispatch.bandclick(d);
          });
        });

      if (self._showAxis) {
        self.renderAxis();
      }

      self.rendered = true;

    });

    return self;
  };

  cyto_chr.chromosome = function() {
    return new Chromosome();
  };

})(window.cyto_chr = window.cyto_chr || {}, d3);

(function (cyto_chr, d3) {

  var defaultDataURLs = {
    "400" : "ideogram_9606_GCF_000001305.14_400_V1",
    "550" : "ideogram_9606_GCF_000001305.14_550_V1",
    "850" : "ideogram_9606_GCF_000001305.14_850_V1",
    "1200" : "ideogram_9606_GCF_000001305.13_1200_v1"
  };

  var baseDir = 'data/';

  function CacheInstance() {
    this.status = "notloaded";
    this.cache = [];
  }

  var dataCache = {
    "400" : new CacheInstance,
    "550" : new CacheInstance,
    "850" : new CacheInstance,
    "1200" : new CacheInstance
  };

  var callQueue = [];

  function loadData(file, res, cb) {

    var c = dataCache[res];
    if (c.cache.length === 0) {
      if (c.status === "loading") {
        callQueue.push({
          res: res,
          cb: cb
        });

        return;
      } else if (c.status === "notloaded") {
        c.status = "loading";
        d3.tsv(file, function(d) {
          c.cache = d;
          c.status = "loaded";
          cb(d);

          while(callQueue.length > 0) {
            var cbq = callQueue.shift();
            cbq.cb(d);
          }

        });
      }
    } else {
      cb(c.cache);
    }
  }

  function getChromosomeData(chr, resolution, cb) {

    chr = chr || '1';
    resolution = resolution || "550";

    var fileName = defaultDataURLs[resolution];

    var d = baseDir + fileName;

    loadData(baseDir + fileName, resolution, function (d) {
      var filteredResults = filterByChromosome(d, chr);
      cb(filteredResults);
    });
  }

  function filterByChromosome(data, chr) {
    var newAry = [];
    for(var i = 0; i < data.length; i++) {
      if (data[i]['#chromosome'] === chr) {
        newAry.push(data[i]);
      }
    }
    return newAry;
  }

  cyto_chr.modelLoader = {
    load: getChromosomeData,
    setDataDir: function(d) {baseDir = d;},
    getDataDir: function() {return baseDir;}
  };

})(window.cyto_chr = window.cyto_chr || {}, d3);

(function(cyto_chr, d3) {

  var Selector = function(closecb) {
    this._brush = d3.svg.brush();
    this.dispatch = d3.dispatch('change');
    this._x = 0;
    this._y = 0;
    this._extent = [0,0];
    this._height = 0;
    this._closecb = closecb;
  };

  Selector.prototype.test = function(e) {
    var self = this;
    return cyto_chr.InitGetterSetter.call(this, "_test", e, function(){
      self._another = "_that";
    });
  };

  Selector.prototype.extent = function (a) {

    var self = this;
    return cyto_chr.InitGetterSetter.call(this, "_extent", a, function(){
      self._brush.extent(a);
    });

  };

  Selector.prototype.xscale = function(a) {

    var self = this;
    return cyto_chr.InitGetterSetter.call(this, "_xscale", a, function(){
      self._brush.x(a)
    });
  };

  Selector.prototype.target = function(a) {
    return cyto_chr.InitGetterSetter.call(this, '_target', a);
  };

  Selector.prototype.height = function(a) {
    return cyto_chr.InitGetterSetter.call(this, '_height', a);
  };

  Selector.prototype.x = function(a) {
    return cyto_chr.InitGetterSetter.call(this, '_x', a);
  };

  Selector.prototype.y = function(a) {
    return cyto_chr.InitGetterSetter.call(this, '_y', a);
  };

  Selector.prototype.render = function() {

    var self = this;

    this.selector = this._target.append('g')
      .classed('selector', true)
      .attr('transform', 'translate(' + this._x + ',' + this._y + ')')
      .call(this._brush);

    this.selector.selectAll('rect')
      .attr('height', this._height);

    this.selector.select('.background').remove();

    var e = this.selector.select('.extent')
      .style('fill', 'steelblue')
      .style('opacity', '0.5');

    var cbg_xpos = this._xscale(this._extent[1]) + cyto_chr.margin.left;
    var cbg_ypos = cyto_chr.margin.top - 3;

    var cbg = this._target.append('g');
    cbg.append('title').text('remove');

    this.deleteButton = cbg.append('circle')
      .attr('cx', cbg_xpos)
      .attr('cy', cbg_ypos)
      .attr('r', 5)
      .attr('fill', 'red')
      //.style('opacity', '0')
      .on('mouseover', function() {
        d3.select(this)
          .style('cursor', 'pointer')
          //.style('opacity', '1');
      })
      .on('mouseout', function(){
        d3.select(this)
          .style('cursor', 'default')
          //.style('opacity', '0');
      })
      .on('click', function() {

        self.remove();
      });

    this._brush.on('brush', function() {
      self.updateXButton();
      self.dispatch.change(e);
    });

    //this._brush.on('brushend', function(d){
    //
    //});

    return this;
  };

  Selector.prototype.remove = function() {
    this.selector.remove();
    this.deleteButton.remove();
    this._closecb(this);
    return this;
  };

  Selector.prototype.updateXButton = function() {
    var e = this._brush.extent();
    var new_xpos = this._xscale(e[1]) + cyto_chr.margin.left;
    this.deleteButton.attr('cx', new_xpos);
  };

  Selector.prototype.move = function(start, stop) {

    this._brush.extent([start, stop]);
    this.selector.call(this._brush);
    this.updateXButton();
  };

  cyto_chr.selector = function(cb){
    return new Selector(cb);
  };

})(window.cyto_chr = window.cyto_chr || {}, d3);

(function(cyto_chr, d3) {

  cyto_chr.initPattern = function () {
    var pg = this.append('pattern')
      .attr('id', 'acen-fill')
      .attr('patternUnits', 'userSpaceOnUse')
      .attr('x', '0')
      .attr('y', '0')
      .attr('width', '10')
      .attr('height', '10')
      .append('g')
      .style({
        "fill": "none",
        "stroke": "#708090",
        "stroke-width": "2"
      });

    pg.append('path')
      .attr('d', "M0,0 l10,10");
    pg.append('path')
      .attr('d','M10,0 l-10,10');
  };

  cyto_chr.roundedRect = function (x, y, w, h, r, tl, tr, bl, br) {
      var retval;
      retval = "M" + (x + r) + "," + y;
      retval += "h" + (w - 2 * r);
      if (tr) {
        retval += "a" + r + "," + r + " 0 0 1 " + r + "," + r;
      } else {
        retval += "h" + r;
        retval += "v" + r;
      }
      retval += "v" + (h - 2 * r);
      if (br) {
        retval += "a" + r + "," + r + " 0 0 1 " + -r + "," + r;
      } else {
        retval += "v" + r;
        retval += "h" + -r;
      }
      retval += "h" + (2 * r - w);
      if (bl) {
        retval += "a" + r + "," + r + " 0 0 1 " + -r + "," + -r;
      } else {
        retval += "h" + -r;
        retval += "v" + -r;
      }
      retval += "v" + (2 * r - h);
      if (tl) {
        retval += "a" + r + "," + r + " 0 0 1 " + r + "," + -r;
      } else {
        retval += "v" + -r;
        retval += "h" + r;
      }
      retval += "z";
      return retval;
    };

  cyto_chr.getStainColour = function (bandtype, density) {

    if(bandtype == "gpos") {
      if(density === "" || density === null) return "#000000";

      switch(density) {
        case "100":
          return "#000000";
        case "75":
          return "#666666";
        case "50":
          return "#999999";
        case "25":
          return "#d9d9d9";
      }
    }

    if (bandtype === "gneg") {
      return "#ffffff";
    }

    if (bandtype === "acen") {
      return "url(#acen-fill)";
      //return "#708090";
    }

    if (bandtype === "gvar") {
      return "#e0e0e0";
    }

    if(bandtype === "stalk") {
      return "#708090";
    }

    return "green";
  };

  cyto_chr.setOption = function (userOption, def) {
      if(typeof userOption !== "undefined") {
        return userOption;
      } else {
        return def;
      }
    };

  cyto_chr.InitGetterSetter = function(prop, arg, cb) {
    if(typeof arg !== 'undefined') {
      this[prop] =  arg;
      if(typeof cb === 'function') {
        cb();
      }
      return this;
    } else {
      return this[prop];
    }
  }

})(window.cyto_chr = window.cyto_chr || {}, d3);