const inquirer = require('inquirer');

inquirer.prompt([
  {
    type: 'editor',
    name: 'cards',
    message: 'Enter the card numbers (one card per line)',
    filter:function(input) {
      return new Promise((resolve,reject) => {
        let cards = input.trim().split('\n').filter(card => card.length > 0);

        if (cards.length > 0) {
          resolve(cards);
        } else {
          reject('No card enter!');
        }
      });
    }
  },
  {
    type: 'password',
    name: 'password',
    mask: '*',
    message: 'Password:'
  }
]).then(answers =>{
 console.log(answers);
});
