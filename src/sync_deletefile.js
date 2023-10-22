"use strict";
import MWBot from "mwbot";
import moment from "moment";

const mirrorAPi = new MWBot({ apiUrl: "https://moegirl.uk/api.php" }, { timeout: 30000 });
const commonsAPi = new MWBot({ apiUrl: "https://commons.moegirl.org.cn/api.php" }, { timeout: 30000 });
/**
  * 登录镜像站
  */
async function login() {
    try {
        await mirrorAPi.loginGetEditToken({
            username: process.env.SBOT_USERNAME,
            password: process.env.SBOT_PASSWORD,
        });
    } catch (error) {
        if (error.ReadTimeout) {
            throw new Error(`登录超时`);
        } else {
            throw new Error(`登录失败：${error}`);
        }
    }
}

const getlog = async () => {
    let PageList = [], apcontinue = "";
    while (apcontinue !== false) {
        try {
            const result = commonsAPi.request({
                'lenamespace': '6',
                'list':'logevents',
                'leaction':'delete/delete',
                'leend':moment(new Date()-32*3600*1000).toJSON(),
                'action': 'query',
                'lelimit': 'max',
                'format': 'json'
                });
            apcontinue = allPages.continue?.apcontinue || false;
            PageList = result.query.logevents;
        } catch (error) {
            throw new Error(`获取共享站删除日志出错：${error}`);
        }
    }
    return PageList;
};
/**
  * 删除文件函数
  * @param {array} logevent
  */
const deletefile = (logevent) => {
    if (logevent.comment.search('[違违]反') !== -1){
        console.log("和谐你全家");
    } else {
        commonsAPi.request({
            "action":"parse",
            "format":"json",
            "page":logevent.title,
            "prop":"wikitext",
        }).then(() => {
            console.log(`${logevent.title}仍然存在共享站，跳过`); //保留可能的旧版本文件调用
        }).catch(async () => {
            mirrorAPi.editToken = (await mirrorAPi.getEditToken()).csrftoken;
            try {
                await mirrorAPi.request({
                    'action':'delete',
                    'format':'json',
                    'title':logevent.title,
                    'reason':"自动删除共享站删除的文件",
                    'token':mirrorAPi.editToken,
                    'tags':'Bot'
                });
                console.log(`已删除${logevent.title}`);
            } catch (err) {
                if (err === "missingtitle") {
                    console.warn("镜像站无", logevent.title);
                } else {
                    console.error("[Delete a file]", e);
                }
            }
        });
    };

};

const main = async (retryCount = 5) => {
    let retries = 0;
    while (retries < retryCount) {
        try {
            await login();
            console.log("登录成功。正在获取删除日志……");

            const deletelog = await getlog();
            const filecount = deletelog.length;
            if(filecount===0){
                console.warn("无可同步删除的文件");
            } else {
                console.log(`正在尝试同步${filecount}条文件删除日志`);
                for(let i=0;i<filecount;i++){
                    deletefile(logevents[i]);// 移动文件函数
                }
            console.log("同步删除文件结束");
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