var fs = require("fs");
var _ = require("underscore");
var report_dir = './report';

fs.readdir(report_dir,(err,files)=>{
	if (err) {
		process.exit();
	}
	
	var reporters = _.chain(files)
		.map(file => report_dir + '/' + file)
		.filter(file => file.endsWith(".txt"))
		// .tap(console.log)
		.map(file => read_data(file).then(make_report))
		.value();
		
	
	Promise.all(reporters).then(function(reports){
		var report, group_by_card, csv;
		
		report = _.chain(reports).flatten().value();
		
		group_by_card = _.groupBy(report, 'card');
		
		csv = _.chain(report)
		.map(row => _.values(row).join(','))
		.reduce((a,b)=>a +  '\n' + b)
		.value()
		;
		
		fs.writeFile('./report.csv', csv, (e)=>{});
	})
	
})

function read_data(data_file) {
	return (new Promise((resolve, reject)=>{
		fs.readFile(data_file, "utf8",(error, content)=>{
			if (error) {
				console.log(error);
				reject({});
			} else {
				resolve(content);
			}
		});	
	}));
}

function make_report(data) {
	return (new Promise((resolve, reject)=>{
		
		var json = JSON.parse(data);
		
		var report = _.chain(json).values() /* remove the keys */
		.map(function(item) {
			var error, message, obj;
			
			obj = _.chain(item)			 
			.extend({'lastChecked' : item['local-datetime'], 'status' : 'OK'})

			if (item['error'] != undefined) {
				error = JSON.parse(item['error']);
			
				if (error['problems']) {
					message = error['problems'].map(p => p.code).reduce((a,b)=>a+','+b);
				} else {
					message = 'other error';
				}
				
				item['status'] = message;
			}

			return obj.pick('card', 'environment', 'lastChecked', 'status').value();
		})
		.value();	
		
		resolve(report);

	}));
}
