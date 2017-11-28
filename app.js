const 
	fs = require('fs'),
	inquirer = require('inquirer'),
	_ = require('lodash'),
	finder = require('./analyze');

const find_commands = _.keys(finder);

inquirer.prompt([
	{
		type: 'list',
		name: 'data_file',
		message: 'Data file:',
		// default: './sit28_11_24_2017__11_58_15_AM.json',
		choices: ['./sit28_11_24_2017__11_58_15_AM.json']
		// choices: function(session) {
		// 	return new Promise((resolve,reject)=>{
		// 		let all_files = fs.readdirSync('.');
		// 		let json_files = _.chain(all_files)
		// 			.filter(file => !file.startsWith('.') && file.endsWith('.json'));
		// 		resolve(json_files);
		// 	});
		// }
	},
	{
		type: 'input',
		name: 'command',
		message: 'Find:',
		filter(answer) {
			return new Promise((resolve,reject)=>{
				let cmd = answer.replace(/ /g, '_');
				if (_.indexOf(find_commands, cmd) < 0 || answer === 'init') {
					reject('Command not found!');
				} else {
					resolve(cmd);
				}
			});
		}
	}
]).then(session => {
	finder.init(session['data_file']);
	finder[session['command']]()
		.then(console.log) ;
});