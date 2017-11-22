const
  express = require('express'),
  auth = require('./auth');

var app = express();

// app.use(express.static('C:\\Users\\Hugh\\Desktop\\src\\localhost\\public'));

/**
 * The order of the app calls below matters
 */
app.all("/api*", function(req, res){
  /* authenticate request */  
  let user = isAuthorized(req);
  if (!user.authorized) {
    res.writeHead(401, "Forbidden");
    res.end();    
    return;
  }

  res.send(`<p>${req.path}</p>`);
});


app.get('*', function (req, res) {
  /* authenticate request */  
  let user = isAuthorized(req);
  if (!user.authorized) {
    res.writeHead(401, "Forbidden");
    res.end();
    return;
  }
    res.send(`<p>Hello ${user.name}</p>`);  

});

app.listen(8080);

function isAuthorized(req) {
  let ip = req.ip.match(/((\d+\.){3}\d+)/)[0] ; 
  let user = auth.authorize(ip, req.path);
  return user;
}
