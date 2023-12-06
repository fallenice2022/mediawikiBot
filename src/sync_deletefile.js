"use strict";
import MWBot from "mwbot";
import moment from "moment";

const mirrorAPi = new MWBot({ apiUrl: "https://moegirl.uk/api.php" }, { timeout: 30000 });
const commonsAPi = new MWBot({ apiUrl: "https://commons.moegirl.org.cn/api.php" }, { timeout: 30000 });
const sleep = (second) => new Promise((res) => setTimeout(res, second * 1000));
/**
  * 登录镜像站
  */
async function login() {
    try {
        await mirrorAPi.login({
            username: process.env.SBOT_USERNAME,
            password: process.env.SBOT_PASSWORD,
        }, { retry: 1 });
    } catch (error) {
        if (error == "ESOCKETTIMEDOUT") {
            throw new Error(`登录超时`);
        } else {
            throw new Error(`登录失败：${error}`);
        }
    }
}
/**
 * @returns {Promise<object[]>}
 */
const getlog = async () => {
    const PageList = []; let apcontinue = "";
    while (apcontinue !== false) {
        try {
            const result = await commonsAPi.request({
                'lenamespace': '6',
                'list': 'logevents',
                'leaction': 'delete/delete',
                'leend': moment(new Date() - 32*3600*1000).toJSON(),
                'action': 'query',
                'lelimit': 'max',
                'format': 'json',
                apcontinue
            }, { retry: 2 });
            apcontinue = result.continue?.apcontinue || false;
            for (const logevent of result.query.logevents) {
                PageList.push(logevent);
            }
        } catch (error) {
            throw new Error(`获取共享站删除日志出错：${error}`);
        }
    }
    return PageList;
};
/**
  * 删除文件函数
  * @param {object} logevent
  * @param {string} logevent.comment
  * @param {string} logevent.title
  */
const deletefile = async (logevent) => {
    if (logevent.comment.search('[違违]反') !== -1) {
        console.log("和谐你全家");
    } else {
        try {
            await commonsAPi.request({
                "action": "parse",
                "format": "json",
                "page": logevent.title,
                "prop": "wikitext",
            }, { retry: 2 });
            console.log(`${logevent.title}仍然存在共享站，跳过`); // 保留可能的旧版本文件调用
        } catch (e) {
            if (e == "ESOCKETTIMEDOUT") {
                console.error(`网络连接超时`);
                setTimeout(deletefile(logevent), 1000);
            } else if (e.code == "missingtitle") {
                mirrorAPi.editToken = (await mirrorAPi.getEditToken()).csrftoken;
                await mirrorAPi.request({
                    'action': 'delete',
                    'format': 'json',
                    'title': logevent.title,
                    'reason': "自动删除共享站删除的文件",
                    'token': mirrorAPi.editToken,
                    'tags': 'Bot'
                }, { retry: 1 }).then(() => {
                    console.log(`已删除${logevent.title}`);
                }).catch(err => {
                    if (err.code === "missingtitle") {
                        console.warn("镜像站无", logevent.title);
                    } else {
                        console.error("[Delete a file]", err);
                    }
                });
            } else {
                throw new Error(`[Delete a file] ${e}`);
            }
        }
    };
};

const main = async (Maxretry = 5, speedlimit = 20) => {
    const count = [0/* retrycount */, speedlimit];
    while (count[0] < Maxretry) {
        try {
            await login();
            console.log("登录成功。正在获取删除日志……");
            const deletelog = await getlog();
            const filecount = deletelog.length;
            if (filecount === 0) {
                console.warn("无可同步删除的文件");
            } else {
                console.log(`正在尝试同步${filecount}条文件删除日志`);
                for (let i = 0; i < filecount; i++) {
                    await deletefile(deletelog[i]);// 删除文件函数
                    speedlimit--;
                    if(speedlimit === 0 && !i === filecount){
                        await sleep(60);
                        speedlimit = count[1];
                    }
                }
                console.log("同步删除文件结束");
            }
            return;
        } catch (error) {
            console.error(`获取数据出错，正在重试（${count[0] + 1}/${Maxretry}）：${error}`);
            count[0]++;
        }
    }
    throw new Error(`运行失败：已连续尝试${Maxretry}次。`);
};

// 最大尝试次数5
main(5, 15).catch(err => {
    console.error(err);
});
