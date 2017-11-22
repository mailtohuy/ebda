const fs = require('fs'),
       _ = require('lodash');

const authorization = require('./access.json');

const access_list =
  _.chain(authorization.users)
  .map(user => _.defaults(user, {
    "role": 'U'
  })) /* default access level = U*/
  .map(user => _.defaults(user, {
    "access": authorization.access[user.role]
  }))
  .map(user => _.pick(user, ['name', 'ip', 'access']))
  .value();

const unknownUser = {
  "name": "unknown",
  "access": []
};
let cache = {};

function getUser(ip) {
  return _.clone(_.find(access_list, {
    'ip': ip
  }) || unknownUser);
}

function addUser(name, ip, role) {

}

function addPermission(role, resource) {

}

function authorize(ip, path) {
  let cache_key = `${ip}${path}`;
  let log_line = `\r\n[${(new Date).toLocaleString()}] ${ip}, ${path}`;

  /* Check cache */
  let memoized_result = cache[cache_key];
  if (memoized_result != undefined) {
    log_line += `, cached: ${JSON.stringify(memoized_result)}`;
    console.log(log_line);
    // console.log("\r\nCache: " + JSON.stringify(cache));
    fs.appendFile('./access.log', log_line);
    return memoized_result;
  }

  /* Check authorization */
  let user = getUser(ip);
  let isAuthorized = _.indexOf(user.access, path) >= 0;
  let retval = _.defaults(user, {
    authorized: isAuthorized
  });

  /* Log the request for this IP & path */
  log_line += `, fresh: ${JSON.stringify(retval)}`;
  console.log(log_line);
  fs.appendFile('./access.log', log_line);

  /* cache the result */
  cache[cache_key] = retval;
  // console.log("\r\nCache: " + JSON.stringify(cache));
  return retval;
};

module.exports = {
  authorize: authorize
};
