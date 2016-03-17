# open-shl-api
API library for SHL(Swedish Hockey League) openapi.shl.se written in ES6 .

ClientId and ClientSecret is required to access API. More info at https://www.shl.se/artikel/74815/.

## Usage
 ```javascript
import OpenShlApiClient from "open-shl-api";

var config = {
    clientId: "xxxxx",
    clientSecret: "xxxxx",
    debug: true,
    cacheTimeout: 10
};
var client = new OpenShlApiClient(config);
client.getPlayerStats(2015, "", ['HV71'])
    .then((data) => {
        console.log("success")
        console.log(data)
    })
    .catch((error) => {
        console.log(error)
    });
 ```
