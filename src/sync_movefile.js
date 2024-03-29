"use strict";
import MWBot from "mwbot";
import moment from "moment";

const mirrorAPi = new MWBot({ apiUrl: "https://moegirl.uk/api.php" }, { timeout: 30000 });
const commonsAPi = new MWBot({ apiUrl: "https://commons.moegirl.org.cn/api.php" }, { timeout: 30000 });
const sleep = (second) => new Promise((res) => setTimeout(res, second * 1000));
/**
 * 登录镜像站
 * @param {new MWBot} siteAPI 
 * @param {string} botname 
 */
async function login(siteAPI, botname) {
    try {
        await siteAPI.login({
            username: process.env[`${botname}_USERNAME`],
            password: process.env[`${botname}_PASSWORD`],
        });
    } catch (error) {
        throw new Error(`登录失败：${error}`);
    }
}
/**
 * @returns {Promise<object[]>}
 */
const getlog = async () => {
    let PageList = [], apcontinue = "||";
    while (apcontinue !== false) {
        try {
            const result = await commonsAPi.request({
                lenamespace: "6",
                list: "logevents",
                leaction: "move/move",
                leend: moment(new Date() - 32 * 3600 * 1000).toJSON(),
                lestart: "",
                action: "query",
                lelimit: "max",
                format: "json",
                apcontinue
            });
            apcontinue = result.continue?.apcontinue || false;
            for (const logevent of result.query.logevents) {
                PageList.push(logevent);
            }
        } catch (error) {
            throw new Error(`获取共享站移动日志出错：${error}`);
        }
    }
    return PageList;
};
/**
  * 移动文件函数
  * @param {object} logevent
  * @param {object} logevent.params
  * @param {string} logevent.params.target_title
  * @param {string} logevent.params.suppressredirect
  * @param {string} logevent.comment
  * @param {string} logevent.title
  */
const movefile = async (logevent) => {
    try {
        mirrorAPi.editToken = (await mirrorAPi.getEditToken()).csrftoken;
        await mirrorAPi.request({
            action: "move",
            from: logevent.title,
            reason: logevent.comment,
            to: logevent.params.target_title,
            format: "json",
            watchlist: "nochange",
            noredirect: "suppressredirect" in logevent.params ? true : false,
            bot: true,
            tags: "Bot",
            token: mirrorAPi.editToken,
        });
        console.log(`已将${logevent.title}移动到${logevent.params.target_title}`);
    } catch (e) {
        switch (e.code) {
            case "missingtitle":
                console.warn("镜像站无", logevent.title);
                break;
            case "articleexists":
                console.error(`目标页面“${logevent.params.target_title}”已存在，请检查！`);
                break;
            default: console.error("[Move a file]", e);
                break;
        }
    }
}

const main = async (Maxretry = 5, speedlimit = 20) => {
    const count = [0/* retrycount */, speedlimit];
    while (count[0] < Maxretry) {
        try {
            await Promise.all([login(mirrorAPi, "IBOT"), login(commonsAPi, "CM")]);
            console.log("登录成功。正在获取移动日志……");
            const movelog = await getlog();
            const filecount = movelog.length;
            if (filecount === 0) {
                console.warn("无可同步移动的文件");
            } else {
                console.log(`正在尝试同步${filecount}条文件移动日志`);
                for (let i = 0; i < filecount; i++) {
                    await movefile(movelog[i]);// 移动文件函数
                    speedlimit--;
                    if (speedlimit === 0 && i !== filecount) {
                        await sleep(60);
                        speedlimit = count[1];
                    }
                }
                console.log("同步移动文件结束");
            }
            return;
        } catch (error) {
            console.error(`获取数据出错，正在重试（${count[0] + 1}/${Maxretry}）：${error}`);
            count[0]++;
        }
    }
    throw new Error(`运行失败：已连续尝试${retryCount}次。`);
};

// 最大尝试次数5
main(5, 15).catch(err => {
    console.error(err);
});;
