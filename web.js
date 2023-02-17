const express = require('express');
const app = express();
app.set("views", __dirname + "/views");
app.set("view engine", "ejs");
app.use(express.static(__dirname + "/public"));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.listen(8002);

const axios = require('axios');
logic = async(name, tag) => {

    //현재 조회중인 플레이어명
    const target = `${name}#${String(tag).toLowerCase()}`;

    //puuid 가져오기 및 파싱
    const puuid = await axios.get(`https://dak.gg/valorant/_next/data/0UwWEikFYni1rYUhT_nKN/ko/profile/${name}-${tag}.json?name=${name}-${tag}`).then(res => res.data.pageProps.account.account.puuid);

    //루프 돌리기 (모든 페이지 정보 긁어오기)
    let page = 1;
    let result = [];
    while (true) {

        //인게임정보 목록 가져오기
        const matchData = await axios.get(`https://val.dakgg.io/api/v1/accounts/${puuid}/matches?page=${page}`).then(res => res.data.matches);

        //인게임정보 목록이 빈 페이지면 결과 출력
        if (matchData === undefined || matchData.length <= 0) return result;

        //인게임 안의 플레이어 정보 가져오기
        for (let i = 0; i < matchData.length; i++) {
            const matchId = matchData[i].matchInfo.matchId;
            const players = await axios.get(`https://dak.gg/valorant/_next/data/0UwWEikFYni1rYUhT_nKN/ko/profile/${name}-${tag}/match/${matchId}.json`).then(res => res.data.pageProps.matchDetail.players);
            
            //플레이어 개별 출력
            for (let j = 0; j < players.length; j++) {
                
                //출력된 플레이어명
                const getPlayer = `${players[j].gameName}#${String(players[j].tagLine).toLowerCase()}`;
                
                //만약 출력된 플레이어와 조회중인 플레이어가 다르면 진행
                if (getPlayer != target) {
                    const tmp = result.findIndex(x => x.user === getPlayer);
                    if (tmp === -1) {
                        if (getPlayer != null) result.push({ user: getPlayer, count: 1 });
                    }
                    else {
                        result[tmp].count++;
                    }
                } 
            }
        }
        page++;
    } 
}

app.post('/api/search', async (req, res) => {
    let name = String(req.body.name).split('#')[0];
    let tag = String(req.body.name).split('#')[1];

    let result;
    try {
        result = await logic(name, tag);
    }
    catch {
        return res.send("err");
    }
    
    //한판 이하인 사람 제외
    const filter = result.filter(x => x.count > 1);

    //내림차순 정렬
    filter.sort((a,b) => {
        if (a.count > b.count) return -1;
        if (a.count < b.count) return 1;
        return 0;
    });

    //값 반환
    res.send(filter);
});

app.get('/', async (req, res) => {
    res.render('index.ejs');
});