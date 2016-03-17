import nodeFetch from 'node-fetch';
import NodeCache from 'node-cache';

export default function OpenShlApiClient(config = {}, fetcher = nodeFetch) {
    if (!config.clientId) {
        throw new Error("clientId must be set");
    }

    if (!config.clientSecret) {
        throw new Error("clientSecret must be set");
    }

    _config.clientId = config.clientId;
    _config.clientSecret = config.clientSecret;
    _config.debug = config.debug;

    fetch = fetcher;
    let cacheInSeconds = config.cacheTimeout || 60;
    fetchCache = new NodeCache({
        stdTTL: cacheInSeconds, // seconds
        checkperiod: cacheInSeconds, // seconds
    });

    debug("Config setup done: ");
    debug(_config);
}

OpenShlApiClient.prototype.getArticles = getArticles;
OpenShlApiClient.prototype.getVideos = getVideos;
OpenShlApiClient.prototype.getGamesInSeason = getGamesInSeason;
OpenShlApiClient.prototype.getGame = getGame;
OpenShlApiClient.prototype.getTeams = getTeams;
OpenShlApiClient.prototype.getTeam = getTeam;
OpenShlApiClient.prototype.getStandings = getStandings;
OpenShlApiClient.prototype.getGoalkeeperStats = getGoalkeeperStats;
OpenShlApiClient.prototype.getPlayerStats = getPlayerStats;

let _config = {
    accessToken: {
        token: null,
        expires: null
    },
    baseUrl: 'https://openapi.shl.se',
    cacheTimeout: null,
    clientId: null,
    clientSecret: null,
    tokenUrl: '/oauth2/token',
};
let fetch, fetchCache;

function getArticles(teams = []) {
    let requestUrl = '/articles';
    if (teams.length > 0) {
        teams.forEach((team, index) => {
            if (index === 0) {
                requestUrl += `?teamIds[]=${team}`;
            } else {
                requestUrl += `&teamIds[]=${team}`;
            }
        });
    }
    return getData(requestUrl);
}

function getVideos(teams = []) {
    let requestUrl = '/videos';
    if (teams.length > 0) {
        teams.forEach((team, index) => {
            if (index === 0) {
                requestUrl += `?teamIds[]=${team}`;
            } else {
                requestUrl += `&teamIds[]=${team}`;
            }
        });
    }
    return getData(requestUrl);
}

function getGamesInSeason(season) {
    return new Promise((resolve, reject) => {
        if (typeof (season) !== 'number' || (season % 1 !== 0)) {
            reject(new Error("season must be an integer"));
        }

        let requestUrl = `/seasons/${season}/games`;

        resolve(getData(requestUrl));
    });

}

function getGame(season, gameId) {

    return new Promise((resolve, reject) => {
        if (typeof (season) !== 'number' || (season % 1 !== 0)) {
            reject(new Error("season must be an integer"));
        }

        if (typeof (gameId) !== 'number' || (gameId % 1 !== 0)) {
            reject(new Error("gameId must be an integer"));
        }

        let requestUrl = `/seasons/${season}/games/${gameId}`;

        resolve(getData(requestUrl));
    });

}

function getStandings(season, teams = []) {

    return new Promise((resolve, reject) => {

        if (typeof (season) !== 'number' || (season % 1 !== 0)) {
            reject(new Error("season must be an integer"));
            return;
        }

        if (!Array.isArray(teams)) {
            reject(new Error("teams must be an array"));
            return;
        }

        let requestUrl = `/seasons/${season}/statistics/teams/standings`;

        if (teams.length > 0) {
            teams.forEach((team, index) => {
                if (index === 0) {
                    requestUrl += `?teamIds[]=${team}`;
                } else {
                    requestUrl += `&teamIds[]=${team}`;
                }
            });
        }

        resolve(getData(requestUrl));
    });
}

function getGoalkeeperStats(season, sort = '', teams = []) {
    return new Promise((resolve, reject) => {
        if (typeof (season) !== 'number' || (season % 1 !== 0)) {
            reject(new Error("season must be an integer"));
        }

        let requestUrl = `/seasons/${season}/statistics/goalkeepers`;
        
        if(typeof(sort) && sort.length > 0) {
            requestUrl += `?sort=${sort}`;
        }

        if (teams.length > 0) {
            teams.forEach((team, index) => {
                if (index === 0 && !requestUrl.includes('?')) {
                    requestUrl += `?teamIds[]=${team}`;
                } else {
                    requestUrl += `&teamIds[]=${team}`;
                }
            });
        }
        resolve(getData(requestUrl));
    });
}

function getPlayerStats(season, sort = '', teams = []) {
    return new Promise((resolve, reject) => {
        if (typeof (season) !== 'number' || (season % 1 !== 0)) {
            reject(new Error("season must be an integer"));
        }

        let requestUrl = `/seasons/${season}/statistics/players`;
        
        if(typeof(sort) && sort.length > 0) {
            requestUrl += `?sort=${sort}`;
        }

        if (teams.length > 0) {
            teams.forEach((team, index) => {
                if (index === 0 && !requestUrl.includes('?')) {
                    requestUrl += `?teamIds[]=${team}`;
                } else {
                    requestUrl += `&teamIds[]=${team}`;
                }
            });
        }

        resolve(getData(requestUrl));
    });
}

function getTeams() {
    return getData('/teams');
}

function getTeam(teamId) {
    return new Promise((resolve, reject) => {
        if (!teamId || typeof (teamId) !== 'string') {
            reject(new Error("teamId must be a string"));
            return;
        }

        let requestUrl = `/teams/${teamId}`;

        resolve(getData(requestUrl));
    });
}

function getData(url) {

    return new Promise((resolve, reject) => {

        const cachedData = fetchCache.get(url);
        if (cachedData) {
            debug(`Returning cached data for: ${url}`);
            resolve(cachedData);
            return;
        }

        getToken()
            .then(() => {
                return fetch(_config.baseUrl + url, getFetchConfig());
            })
            .then((res) => {
                if (!res.ok) {
                    debug(`Invalid response: ${res.status} - ${res.statusText}`)
                    reject(new Error(`Invalid response: ${res.status} - ${res.statusText}`));
                    return;
                }

                let dataPromise = res.json();
                resolve(dataPromise);
                return dataPromise;
            })
            .then((data) => {
                debug(`Caching result for ${url}`);
                fetchCache.set(url, data);
            });

    });
}

function setAccessToken(json) {
    let d = new Date();
    d.setSeconds(d.getSeconds() + json.expires_in);

    _config.accessToken.token = json.access_token;
    _config.accessToken.expires = d;
}

function getFetchConfig() {
    return {
        headers: {
            'Authorization': `bearer ${_config.accessToken.token}`
        }
    };
}

function getToken() {

    return new Promise((resolve, reject) => {

        if (hasValidToken()) {
            debug("Using cached token");
            resolve();
            return;
        }

        debug("Getting a new accessToken..");
        let body = `client_id=${_config.clientId}&client_secret=${_config.clientSecret}&grant_type=client_credentials`;

        fetch(_config.baseUrl + _config.tokenUrl, {
            method: 'POST',
            body: body,
            headers: {
                'content-type': 'application/x-www-form-urlencoded'
            }
        })
            .then((res) => {
                if (!res.ok) {
                    debug(`Invalid response: ${res.status} - ${res.statusText}`)
                    reject(new Error(`Invalid response: ${res.status} - ${res.statusText}`));
                }
                return res.json();
            })
            .then((json) => {
                setAccessToken(json);
                resolve();
            });
    });

}

function debug(message) {
    if (_config.debug) {
        console.log(message);
    }
}

function hasValidToken() {
    if (!_config.accessToken.expires) {
        return false;
    }
    return _config.accessToken.expires > new Date();
}
