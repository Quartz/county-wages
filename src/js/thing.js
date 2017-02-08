// NPM modules
var d3 = require('d3');
var request = require('d3-request');
var _ = require('lodash');

// Local modules
var features = require('./detectFeatures')();
var fm = require('./fm');
var utils = require('./utils');

// Globals
var DEFAULT_WIDTH = 940;
var MOBILE_BREAKPOINT = 600;

var graphicData = null;
var isMobile = false;
var sortOrder = 'employment_1990';
var lineBase = 'start';

var axisFormat = d3.format(',');

/**
 * Initialize the graphic.
 *
 * Fetch data, format data, cache HTML references, etc.
 */
function init() {
	d3.select('#sort').on('change', onSortChange);
	d3.select('#base').on('change', onBaseChange);

	request.csv('data/states.csv', function(error, data) {
		graphicData = formatData(data);
		onSortChange();

		$(window).resize(utils.throttle(onResize, 250));
	});
}

/**
 * Format data or generate any derived variables.
 */
function formatData(data) {
	data.forEach(function(d) {
		d['employment_1990'] = + d['employment_1990'];
		d['employment_2015'] = + d['employment_2015'];
		d['wages_1990'] = + d['wages_1990'];
		d['wages_2015'] = + d['wages_2015'];
		d['wages_change'] = d['wages_2015'] - d['wages_1990'];
		d['wages_pct_change'] = d['wages_change'] / d['wages_1990'];
	});

	return data;
}

function onSortChange(e) {
	sortOrder = d3.select(this).property('value');

	graphicData = _.sortBy(graphicData, sortOrder);
	render();
}

function onBaseChange(e) {
	lineBase = d3.select(this).property('value');

	render();
}

/**
 * Invoke on resize. By default simply rerenders the graphic.
 */
function onResize() {
	render();
}

/**
 * Figure out the current frame size and render the graphic.
 */
function render() {
	var width = $('#interactive-content').width();

	if (width <= MOBILE_BREAKPOINT) {
		isMobile = true;
	} else {
		isMobile = false;
	}

	renderGraphic({
		container: '#graphic',
		width: width,
		data: graphicData
	});

	// Inform parent frame of new height
	fm.resize()
}

/*
 * Render the graphic.
 */
function renderGraphic(config) {
	// Configuration
	var aspectRatio = 3 / 2;

	var labelWidth = 100;
	var labelMargin = 10;
	var barHeight = 20;
	var barGap = 5;

	var margins = {
		top: 10,
		right: 30,
		bottom: 50,
		left: 10
	};

	// Calculate actual chart dimensions
	var width = config['width'];

	var chartWidth = width - (margins['left'] + margins['right'] + labelWidth + labelMargin);
	var chartHeight = (barHeight + barGap) * config['data'].length;

	// Clear existing graphic (for redraw)
	var containerElement = d3.select(config['container']);
	containerElement.html('');

	// Create the root SVG element
	var chartWrapper = containerElement.append('div')
		.attr('class', 'graphic-wrapper');

	var chartElement = chartWrapper.append('svg')
		.attr('width', chartWidth + margins['left'] + margins['right'] + labelWidth + labelMargin)
		.attr('height', chartHeight + margins['top'] + margins['bottom'])
		.append('g')
		.attr('transform', 'translate(' + margins['left'] + ',' + margins['top'] + ')');

	var chartBodyElement = chartElement.append('g')
		.attr('class', 'body')
		.attr('width', chartWidth + margins['left'] + margins['right'])
		.attr('height', chartHeight + margins['top'] + margins['bottom'])
		.attr('transform', 'translate(' + (labelWidth + labelMargin) + ',' + 0 + ')');

	// Create scales
	var xScale = d3.scale.linear()
		.range([0, chartWidth])
		.domain([0, 1500]);

	// Create axes
	var xAxis = d3.svg.axis()
		.scale(xScale)
		.orient('bottom')
		.tickValues([0, 500, 1000, 1500])
		.tickFormat(axisFormat);

	// Render axes
	var xAxisElement = chartBodyElement.append('g')
		.attr('class', 'x axis')
		.attr('transform', utils.makeTranslate(0, chartHeight))
		.call(xAxis);

	// Render axes grids
	var xAxisGrid = function() {
		return xAxis;
	};

	xAxisElement.append('g')
		.attr('class', 'x grid')
		.call(xAxisGrid()
			.tickSize(chartHeight, 0)
			.tickFormat('')
		);

	// Render lines
	chartBodyElement.append('g')
		.attr('class', 'lines')
		.selectAll('line')
		.data(config['data'])
		.enter()
		.append('line')
			.attr('x1', function(d) {
				if (lineBase == 'start') {
					return xScale(d['wages_1990']);
				}

				return 0;
			})
			.attr('x2', function(d) {
				if (lineBase == 'start') {
					return xScale(d['wages_2015']);
				}

				return xScale(d['wages_change']);
			})
			.attr('y1', function(d, i) {
				return i * (barHeight + barGap) + (barHeight / 2);
			})
			.attr('y2', function(d, i) {
				return i * (barHeight + barGap) + (barHeight / 2);
			})

	_.each(['1990', '2015'], function(year) {
		chartBodyElement.append('g')
			.attr('class', 'dots')
			.selectAll('circle')
			.data(config['data'])
			.enter()
			.append('circle')
			   .attr('r', 2)
			   .attr('cx', function(d) {
				   if (lineBase == 'start') {
					   return xScale(d['wages_' + year]);
				   } else if (year == '1990') {
					   return 0;
				   } else {
					   return xScale(d['wages_change']);
				   }
			   })
			   .attr('cy', function(d, i) {
				   	return i * (barHeight + barGap) + (barHeight / 2);
			   })
			   .attr('class', function(d, i) {
				   return 'dot year-' + year;
			   })
			//    .attr('id', function(d) {
			// 	   return classify(d['county']);
			//    });
	});

	/*
	* Render bar labels.
	*/
	chartElement.append('g')
		.attr('class', 'labels')
		.selectAll('text')
		.data(config['data'])
		.enter()
		.append('text')
			.attr('dy', function(d, i) {
				 return i * (barHeight + barGap) + (barHeight / 2);
			})
			.text(function(d) {
				return d['area_title'];
			})
}

/*
 * Convert key/value pairs to a style string.
 */
var formatStyle = function(props) {
    var s = '';

    for (var key in props) {
        s += key + ': ' + props[key].toString() + '; ';
    }

    return s;
}

// Bind on-load handler
$(document).ready(function() {
	init();
});
