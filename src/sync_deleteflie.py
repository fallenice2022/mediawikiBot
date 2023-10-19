import requests
import os
import json
from datetime import datetime,timedelta
import re
    
workspace = { #创建字典用以储存用户和令牌信息
    'URL': "https://moegirl.uk/api.php",
    'SESSION': requests.Session(),
    'lgname': process.env.SBOT_NAME,
    'lgpassword': process.env.SBOT_PASSWORD, 
    'csrftoken': '',
    }

def LogIn( ):
    
    # 输入：无
    # 功能：用户登录，返回登录结果
    # 输出：无

    token = FetchToken("login")
    params = {
        "action": "login",
        "lgname": workspace['lgname'],
        "lgpassword": workspace['lgpassword'],
        "lgtoken": token,
        "format": "json"
        }
    data = MPostAPI(params)
    if(data["login"]["result"] == "Success"):
        print("登录成功，登录用户名："+ data["login"]["lgusername"] +"\n可以开始执行操作")
    else:
        print("登录失败，请退出重试")

def FetchToken(tokentype):
    
    # 输入：字符串类型，需要请求的令牌类型。（可选参数：csrf-编辑令牌, login-登录令牌, rollback-回退令牌, patrol-巡查令牌）
    # 功能：请求各类令牌
    # 输出：字符串类型，令牌参数

    params = {
        "action": "query",
        "meta": "tokens",
        "type": tokentype,
        "format": "json"
        }
    data = MPostAPI(params)
    return data['query']['tokens'][tokentype+'token']

def MPostAPI(params, timeout=20):

    # 输入：字典类型，访问API的模块名、方法名和参数等
    # 功能：将一个请求通过API提交并解析返回值（JSON格式）
    # 输出：字典类型，经过解析的原始返回值
    # 另注：鉴于内容很多，取消了timeout参数，不然时间不足以完全提交上去

    try:
        resource = workspace['SESSION'].post(url = workspace['URL'], data = params)
        data = resource.json()
        return data
    except requests.exceptions.ReadTimeout:
        print(params["action"] + "操作超时，程序已暂停")
        os.system("pause") #暂停程序
        return None
    except:
        print(params["action"] + "操作错误，程序已暂停")
        os.system("pause") #暂停程序
        return {}

def main ( ):
    nowDate = datetime.now()
    updateDate = nowDate - timedelta(hours=8) - timedelta(days=1)
    print(datetime.strftime(updateDate,'%Y-%m-%dT%H:%M:%SZ'))
    resource1 = workspace['SESSION'].get("https://commons.moegirl.org.cn/api.php", params ={
        'lenamespace': '6',
        'list':'logevents',
        'leaction':'delete/delete',
        'leend':datetime.strftime(updateDate,'%Y-%m-%dT%H:%M:%SZ'),
        'action': 'query',
        'lelimit': 'max',
        'format': 'json'
        })
    data1 = json.loads(resource1.text)
    events = data1['query']['logevents']
        
    if len(events) == 0:
        print("无可同步删除的文件")
    else:
        for i in range(len(events)):
            cmappear = workspace['SESSION'].get("https://commons.moegirl.org.cn/api.php", params ={
                "action":"parse",
                "format":"json",
                "page":events[i]['title'],
                "prop":"wikitext"
                })
            data2 = json.loads(cmappear.text)
            parameters = {
                'action':'delete',
                'format':'json',
                'title':events[i]['title'],
                'reason':"自动删除共享站删除的文件",
                'token':FetchToken("csrf"),
                'tags':'Bot'
            }
            if re.search('[違违]反法律法[规規]', events[i]['comment']):
                print("和谐你全家")
            if 'error' in data2 and 'code' in data2['error']:#el
                result = MPostAPI(parameters)
                if 'error' in result and 'code' in result['error']:
                    print("镜像站无" + events[i]['title'])
                else:
                    print("已删除" + events[i]['title'])
            else:
                print("skipping page " + events[i]['title'])

LogIn()
main()
