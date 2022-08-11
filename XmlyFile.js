const axios = require('axios');
const https = require("https");
// const { spawn } = require("child_process");
const fs = require("fs");
const http = require("http");
const path = require("path");
const crypt = require('./crypt');
const cryptFn = crypt();


const PREDOWNLOAD = 'predownload';    // 预下载
const DOWNLOADING = 'DOWNLOADING';    // 下载中
const TRANSFORMING = 'transforming';  // 转换阶段
const DONE = 'done';                  // 完成
const DOWNLOADERROR = 'downloaderror';// 下载出错
const headers ={
  // set vip cookie
  /**
   * vip 专辑的这里配置 cookie
   */
  'cookie':"1&_token=xxxxxxxx;",
  'User-Agent': "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/102.0.5005.63 Safari/537.36 Edg/102.0.1245.39"

}

class XmlyFile {
  constructor(params) {
    const { trackId, name, savePath } = params;
    if (!trackId || !name || !savePath) {
      return new Error('trackId, name, savePath is required');
    }
    this.name = name;
    this.savePath = savePath;
    this.state = PREDOWNLOAD;
    this.progress = 0;
    this.trackId = trackId;
    this.callbacks = [];
    this.size = 0;
    this.info = {};
  }

  emitState(state) {
    this.callbacks.forEach((cb) => {
      cb(state)
    })
  }

  subScribeStatu(callback) {
    if (typeof callback === 'function') {
      this.callbacks.push(callback)
    }
  }

  async getVipAudioUrl() {
    const {data} = await axios.get(`https://mpay.ximalaya.com/mobile/track/pay/${this.trackId}/?device=pc`, {headers});
    if (data?.ret === 999 || data?.ret === 726) {
      this.emitState({
        statu: -1,
        trackId: this.trackId,
        name: this.name,
        message: data?.msg || '',
        method: 'getVipAudioUrl',
        progress: this.progress,
      })
      return;
    }
    this.info = {
      name: this.name,
      duration: data.duration,
      totalLength: 14160566,
      trackId: 245931881,
    }
    const m = function (e) {
      return e.indexOf("audio.pay.xmcdn.com") > -1 ? "https://vod.xmcdn.com" : e;
    };
    function serialize(obj) {
      var str = [];
      for (var p in obj)
        if (obj.hasOwnProperty(p)) {
          str.push(encodeURIComponent(p) + "=" + encodeURIComponent(obj[p]));
        }
      return str.join("&");
    }
    const n = data.seed,
      o = data.fileId,
      a = data.ep,
      u = data.duration,
      l = data.domain,
      s = data.apiVersion,
      p = cryptFn.getEncryptedFileName(n, o),
      d = cryptFn.getEncryptedFileParams(a);
    d.duration = u;
    const y = m(l),
      b = "".concat(y, "/download/").concat(s).concat(p),
      v = "".concat(b, "?").concat(serialize(d));
    return v;
  }

  downloadFile(url) {
    let get = http.get;
    if (url.startsWith('https')) {
      get = https.get
    } 
    get(url, (res) => {
      this.size = res.headers["content-length"] || 1;
      var writeStream = fs.createWriteStream(path.join(this.savePath, this.name));
      this.state = DOWNLOADING;
      let length = 0;
      res.on("data", (chunk) => {
        length += chunk.length;
        this.progress = length / this.size;
        writeStream.write(chunk);
        this.emitState({
          statu: 1,
          trackId: this.trackId,
          name: this.name,
          message: 'downloading',
          method: 'downloadFile',
          progress: this.progress,
        })
      }).on("end", () => {
        writeStream.close();
        this.state = TRANSFORMING;
        this.emitState({
          statu: 0,
          trackId: this.trackId,
          name: this.name,
          message: 'downloaded',
          method: 'downloadFile',
          progress: length / this.size,
        })
      })
    })
  }

  async startDownLoad() {
    try {
      const noVipRes = axios.get(`https://www.ximalaya.com/revision/play/v1/audio?id=${this.trackId}&ptype=1`)
      if (noVipRes?.data?.isVipFree === false && noVipRes?.data?.isPaid === false) {
        this.downloadFile(noVipRes.data.src);
      } else {
        const vipUrl = await this.getVipAudioUrl(this.trackId);
        this.downloadFile(vipUrl);
      }
    } catch (e) {
      this.emitState({
        statu: -1,
        trackId: this.trackId,
        name: this.name,
        message: e || '',
        method: 'startDownLoad',
        progress: this.progress,
      })
    }
  }

  // toMp3() {
  //   const basename = path.basename(this.name, '.m4a');
  //   spawn("ffmpeg", ["-y", "-i", path.join(this.savePath, this.name), "-acodec", "libmp3lame", path.join(this.savePath, basename + '.mp3')]);
  // }
}

module.exports =  XmlyFile;
