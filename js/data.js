function getSymbols() {
	d3.json('//api.baktrader.com/symbols', function (error, json) {
		// TODO: do something here...
	});
};

function getIndicators(symbol) { // are these symbol-specific?
	
};
var chart;
function getData() {
	d3.json('//api.baktrader.com/bak', function (error, json) {
		var data = { columns: [] };
		for (var i = 0; i < json[0].data.length; i++) {
			var arr = [];
			arr.push(json[0].data[i].name);
			for (var j = 0; j < json[0].data[i].values.length; j++) {
				arr.push(json[0].data[i].values[j]);
			}
			data.columns.push(arr);
		}
		chart = c3.generate({
			bindto: '#chart',
			data: data
		});
	});
};
window.onresize = function () {
	chart.resize();
};