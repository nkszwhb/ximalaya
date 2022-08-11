### 喜马拉雅下专辑音频

> 程序执行需要node 环境，使用先装依赖，执行 npm install



不用vip的专辑把地址贴到 main.js 里面的地址

需要vip的专辑，登陆喜马拉雅网页端之后找到cookie，把 `1&_token` 这个东西 贴到 `XmlyFile.js` 这个文件的header里面去,

```js
const headers ={
  /**
   * vip 专辑的这里配置 cookie
   */
  'cookie':"1&_token=xxxxxxxx;",
  'User-Agent': "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/102.0.5005.63 Safari/537.36 Edg/102.0.1245.39"

}

```

启动下载 执行

```bash
node test
或
node main.js
```

