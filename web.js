const express = require('express');
const app = express();
app.set("views", __dirname + "/views");
app.set("view engine", "ejs");
app.use(express.static(__dirname + "/public"));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.listen(8002);


function changeMillis(t) {
    const millisToMin = (t/(1000*60))%60;
    const minStr = String(millisToMin).split('.');
    const minutes = parseInt(minStr[0]);
    const seconds = minStr[1] === undefined ? 0 : ((Number(minStr[1])/100)*60).toFixed(0).substring(0, 2);
    return { minutes, seconds };
}

const axios = require('axios');
logic = async(name, tag, refresh) => {

    //현재 조회중인 플레이어명
    const target = `${name}#${String(tag).toLowerCase()}`;

    //puuid 가져오기 및 파싱
    const puuid = await axios.get(`https://dak.gg/valorant/_next/data/vWZroJ-Pa5YzvCFX2WEHp/ko/profile/${name}-${tag}.json?name=${name}-${tag}`).then(res => res.data.pageProps.account.account.puuid);

    //새로고침 활성화 시 전적 새로고침 (dak.gg)
    if (refresh) await axios.get(`https://val.dakgg.io/api/v1/rpc/account-sync/by-puuid/${puuid}`);

    //루프 돌리기 (모든 페이지 정보 긁어오기)
    let page = 1;
    let result = [];
    let maps = [];
    let matchesLen = 0;
    let filterMatchesLen = 0;
    let allMinutes = 0;
    let allSeconds = 0;
    let headshot = 0;
    let bodyshot = 0;
    let legshot = 0;
    let kd = 0;
    while (true) {

        //인게임정보 목록 가져오기
        const matchData = await axios.get(`https://val.dakgg.io/api/v1/accounts/${puuid}/matches?page=${page}`).then(res => res.data.matches);

        //인게임정보 목록이 빈 페이지면 결과 출력
        if (matchData === undefined || matchData.length <= 0) return { 
            players: result, 
            matchesLen,
            filterMatchesLen,
            allMinutes,
            allSeconds,
            maps,
            headshot: headshot/matchesLen,
            bodyshot: bodyshot/matchesLen,
            legshot: legshot/matchesLen,
            kd: kd/matchesLen
        };

        //총 매치 수
        matchesLen += matchData.length;

        //게임 데이터 개별 출력
        for (let i = 0; i < matchData.length; i++) {

            //플레이한 맵명 가져오기
            const mapName = matchData[i].matchInfo.mapName;

            //총 플레이타임 계산
            const getTime = changeMillis(matchData[i].matchInfo.gameLengthMillis);
            allMinutes += Number(getTime.minutes);
            allSeconds += Number(getTime.seconds);

            //게임 데이터 목록 중 하나
            const matchId = matchData[i].matchInfo.matchId;

            //게임 데이터 안의 플레이어 데이터 가져오기
            const players = await axios.get(`https://dak.gg/valorant/_next/data/vWZroJ-Pa5YzvCFX2WEHp/ko/profile/${name}-${tag}/match/${matchId}.json`).then(res => res.data.pageProps.matchDetail.players);
            
            //맵 정보 갱신
            const idx1 = maps.findIndex(x => x.name === mapName);
            if (idx1 === -1) maps.push({ name: mapName, count: 1 });
            else maps[idx1].count++;

            //플레이어 개별 출력
            for (let j = 0; j < players.length; j++) {
                
                //출력된 플레이어명
                const getPlayer = `${players[j].gameName}#${String(players[j].tagLine).toLowerCase()}`;

                
                //만약 출력된 플레이어와 조회중인 플레이어가 다르면 진행
                if (getPlayer != target) {
                    const idx2 = result.findIndex(x => x.user === getPlayer);
                    if (idx2 === -1) {
                        if (getPlayer != null) result.push({ user: getPlayer, count: 1 });
                    }
                    else {
                        result[idx2].count++;
                    }
                } 
                else {
                    if (matchData[i].matchInfo.queueId === 'unrated' || matchData[i].matchInfo.queueId === 'competitive') {
                        filterMatchesLen++;
                        headshot += matchData[i].stat.headshots;
                        bodyshot += matchData[i].stat.bodyshots;
                        legshot += matchData[i].stat.legshots;
                        kd += Math.round(players[j].stats.kills / players[j].stats.deaths);
                    }
                }
            }
        }
        page++;
    } 
}

const requsetIP = require('request-ip');
app.post('/api/search', async (req, res) => {
    let name = String(req.body.name).split('#')[0];
    let tag = String(req.body.name).split('#')[1];

    const pan = Number(req.body.pan.includes("-") ? "0" : req.body.pan);

    const refresh = req.body.refresh;

    let result;
    try {
        result = refresh === "true" ? await logic(name, tag, true) : await logic(name, tag, false);
    }
    catch (e) {
        console.log(e)
        return res.send("err");
    }

    //한판 이하인 사람 제외
    const filter = result.players.filter(x => x.count >= pan);

    //내림차순 정렬
    filter.sort((a,b) => {
        if (a.count > b.count) return -1;
        if (a.count < b.count) return 1;
        return 0;
    });

    result.maps.sort((a,b) => {
        if (a.count > b.count) return -1;
        if (a.count < b.count) return 1;
        return 0;
    });

    let topMap = result.maps[0];

    //요청자 IP확인
    console.log(`post ip: ${requsetIP.getClientIp(req)}`);

    let mapImg = "";

    if (topMap.name === 'lotus') {
        mapImg = "https://images.contentstack.io/v3/assets/bltb6530b271fddd0b1/bltaae67d0ec5006ef5/63b8a78d28c9fb7a1880a9e2/Lotus_MapWebsite_Web.png";
        topMap.name = "로터스";
    }
    if (topMap.name === 'pearl') {
        mapImg = "https://images.contentstack.io/v3/assets/bltb6530b271fddd0b1/bltd0a2437fb09ebde4/62a2805b58931557ed9f7c9e/PearlLoadingScreen_MapFeaturedImage_930x522.png";
        topMap.name = "펄";
    }
    if (topMap.name === 'fracture') {
        mapImg = "https://images.contentstack.io/v3/assets/bltb6530b271fddd0b1/bltf4485163c8c5873c/6131b23e9db95e7ff74b6393/Valorant_FRACTURE_Minimap_Alpha_web.png";
        topMap.name = "프랙처";
    }
    if (topMap.name === 'breeze') {
        mapImg = "https://images.contentstack.io/v3/assets/bltb6530b271fddd0b1/bltb03d2e4867f2e324/607f995892f0063e5c0711bd/breeze-featured_v1.png";
        topMap.name = "브리즈";
    }
    if (topMap.name === 'icebox') {
        mapImg = "https://images.contentstack.io/v3/assets/bltb6530b271fddd0b1/bltde02911a015d7ef9/5f80d2851f5f6d4173b4e49d/Icebox_transparentbg_for_Web.png";
        topMap.name = "아이스박스";
    }
    if (topMap.name === 'bind') {
        mapImg = "https://images.contentstack.io/v3/assets/bltb6530b271fddd0b1/blt8538036a309525ae/5ebc470bfd85ad7411ce6b50/bind-featured.png";
        topMap.name = "바인드";
    }
    if (topMap.name === 'haven') {
        mapImg = "https://images.contentstack.io/v3/assets/bltb6530b271fddd0b1/blt8afb5b8145f5e9b2/5ebc46f7b8c49976b71c0bc5/haven-featured.png";
        topMap.name = "헤이븐";
    }
    if (topMap.name === 'split') {
        mapImg = "https://images.contentstack.io/v3/assets/bltb6530b271fddd0b1/bltd188c023f88f7d91/5ebc46db20f7727335261fcd/split-featured.png";
        topMap.name = "스플릿";
    }
    if (topMap.name === 'ascent') {
        mapImg = "https://images.contentstack.io/v3/assets/bltb6530b271fddd0b1/blta9b912e1a1b59aa4/5ebc471cfa550001f72bcb13/ascent-featured.png";
        topMap.name = "어센트";
    }

    result.allMinutes += parseInt(result.allSeconds/60);
    result.allSeconds = result.allSeconds%60;

    console.log(result.allMinutes);

    //값 반환
    res.send({ 
        filter, 
        matchesLen: result.matchesLen,
        filterMatchesLen: result.filterMatchesLen,
        allMinutes: result.allMinutes,
        allSeconds: result.allSeconds,
        map: topMap,
        mapImg,
        kd: (result.kd).toFixed(2),
        headshot: (result.headshot).toFixed(0),
        bodyshot: (result.bodyshot).toFixed(0),
        legshot: (result.legshot).toFixed(0)
    });
});

app.get('/', async (_, res) => {
    res.render('index.ejs');
});