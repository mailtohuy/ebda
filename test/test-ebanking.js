const 
  chai = require('chai'),  
  app = require('../ebanking');

describe("request-promise", ()=>{
  it("should reject invalid URL", ()=>{
    let url = 'https://stackoverflow.com';
    app.request(url, 'GET')
    .then(console.log('fail'))
    .catch(console.log('pass'));
  });
})