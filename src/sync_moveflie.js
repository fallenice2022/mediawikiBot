"use strict";
import MWBot from "mwbot";
import moment from "moment";

const mirrorAPi = new MWBot({
    apiUrl: "https://moegirl.uk/api.php",
}, {
    timeout: 30000,
});
/**
  * 登录镜像站
  */
async function login() {
    try {
        await bot.loginGetEditToken({
            username: process.env.IBOT_USERNAME,
            password: process.env.IBOT_PASSWORD,
        });
    } catch (error) {
        throw new Error(`登录失败：${error}`);
    }
}
 
const getlog = async () => {
    let PageList = [], apcontinue = "";
    while (apcontinue !== false) {
        try {
            const result = new MWBot({apiUrl: "https://commons.moegirl.org.cn/api.php"}, {timeout: 30000}).request({
                lenamespace: "6",
                list:"logevents",
                leaction:"move/move",
                leend:moment(new Date()-32*3600*1000).toJSON(),
                lestart:"",
                action: "query",
                lelimit: "max",
                format: "json",
            });
            apcontinue = allPages.continue?.apcontinue || false;
            PageList = result.query.logevents;
        } catch (error) {
            throw new Error(`获取共享站移动日志出错：${error}`);
        }
    }
    return PageList;
};
const movefile = async (logevent) => {
    try {
        bot.editToken = (await bot.getEditToken()).csrftoken;
        await bot.request({
            action: "move",
            from:logevent.title,
            reason:logevent.comment,
            to:logevent.params.target_title,
            format: "json",
            watchlist: "nochange",
            noredirect: "suppressredirect" in logevent.params ?true :false,
            bot:true,
            tags:"Bot",
            token: bot.editToken,
        });
        console.log(`已将${logevent.title}移动到${logevent.params.target_title}`);
    } catch (e) {
        switch (e) {
            case "missingtitle":
                console.warn("镜像站无", logevent.title);
                break;
            case "articleexists":
                console.error(`目标页面“${logevent.params.target_title}”已存在，请检查！`);
                break;
            default:console.error("[Move a file]", e);
                break;
        }
    }
}

const main = async (retryCount = 5) => {
    let retries = 0;
    while (retries < retryCount) {
        try {
            await login();
            console.log("登录成功。正在获取所有页面……");

            const movelog = await getlog();
            const filecount = movelog.length;
            if(filecount===0){
                console.warn("无可同步移动的文件", { type: "warn" });
            } else {
                console.log(`正在尝试同步${filecount}条文件移动日志`);
                for(let i=0;i<filecount;i++){
                    await movefile(logevents[i]);// 移动文件函数
                }
            console.log("同步移动文件结束", { type: "success" });
        }
            return;
        } catch (error) {
            console.error(`获取数据出错，正在重试（${retries + 1}/${retryCount}）：${error}`);
            retries++;
        }
    }
    throw new Error(`运行失败：已连续尝试${retryCount}次。`);
};

// 最大尝试次数5
main(5);
