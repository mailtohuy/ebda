const _ = require("underscore"),
  fs = require("fs"),
  eb = require('./ebanking');

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

function fetch_data(cards)	{	

	var sessions = {};
			
	cards.map( card => sessions[card] = { 'card' : card } );
	
	Promise.all(
		cards.map( card => signOnAndGetAccounts(environment, card, sessions[card]) )
	).then(() => {
		var file_name = "./" + environment + "_" + (new Date).toLocaleString().replace(/[\/:- ]/ig, '_') + ".json";
		fs.writeFile(file_name, JSON.stringify(sessions));
		return file_name;
	});
	
}

function signOnAndGetAccounts(environment, card, session_data) {

	return eb.signOn(environment, card, session_data)
	.then(eb.getAccounts)
	.then(eb.signOff)
	.then(session_data => console.log("%s - [%s]" , session_data['card'], session_data['time'] ))
	.catch(function(session_data) {				
		var error = JSON.parse(session_data['error']),
		message ;
	
		if (error['problems']) {
			message = error['problems']
			.map(p => p.code + (p.details.message ? " " + p.details.message : ""))
			.reduce((a,b)=>a+','+b);
		} else {
			message = session_data['error'];
		}
		
		console.log("%s - [%s]: %s!" , session_data['card'], session_data['time'] , message)
	} );
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

