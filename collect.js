const 
	eb = require('./ebanking'),
	_ = require('lodash'),
	fs = require("fs");
  
var card_file, environment;

if ((process.argv[2] == undefined) || (process.argv[3] == undefined)) {
	console.log('node collect.js <card_file> <environment>\n');
	process.exit();
	
} else {
	card_file = process.argv[2] ;
	environment = process.argv[3] ;
	
	read_cards(card_file)
		.then(fetch_data)
	;
}

function signOnAndGetAccounts(environment, card, session_data) {

	return eb.signOn(environment, card, session_data)
		.then(eb.getAccounts)
		.then(eb.signOff)
		.then(session_data => {
		// console.log("%s - [%s]" , session_data['card'], session_data['time'] );
			console.log("%s done!" , session_data['card']);
			return session_data;
		})
		.catch(function(session_data) {				
			var error = JSON.parse(session_data['error']),
				message ;
		
			//TODO: handle OTVC
			if (error['problems']) {
				message = error['problems']
					.map(p => p.code + (p.details.message ? " " + p.details.message : ""))
					.reduce((a,b)=>a+','+b);
			} else {
				message = session_data['error'];
			}
			console.log("%s: %s!" , session_data['card'], message)
		} );
}

function fetch_data(cards)	{	
	console.time('fetch_data');
	var sessions = {};
			
	/* initialize the sessions */
	cards.map( card => sessions[card] = { 'card' : card } );
	
	/* run sequentially -> no 0001 errors */ 
	return cards.map(card=> ()=>signOnAndGetAccounts(environment, card, sessions[card]))
		.reduce(
			(resultBin,aRequest)=>
				resultBin.then(result=>aRequest().then(Array.prototype.concat.bind(result)))
			, Promise.resolve([])
		).then(allResults => {
			var file_name = "./" + environment + "_" + ((new Date).toLocaleString().replace(/[\/,: ]/ig,'_')) + ".json";
			fs.writeFile(file_name, JSON.stringify(sessions)); // { <card1#> : <data1>, <card2#> : <data2>}		
			return file_name;
		});
}



	
function read_cards(data_file) {
	return (new Promise((resolve, reject)=>{
		var cards = [];
		fs.readFile(data_file, "utf8",(error, content)=>{
			if (error) {
				console.log(error);
				reject(error);
			} else {

				cards = _.chain(content.split("\r\n"))
					.map(chunk => chunk.split("\n"))
					.flatten()
					.map(chunk => chunk.trim())
					.reject(chunk => (chunk.length == 0) || (chunk.startsWith("/")))
					.uniq()
					.value()
				
				resolve(cards);
			}
		});	
	}));
}

