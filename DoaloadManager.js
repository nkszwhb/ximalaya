const axios = require('axios');
const XmlyFile = require('./XmlyFile');
const path = require("path");
const fs = require("fs");
const pagesize = 60;
let isAsc = true;


function getURL(albumId, pageId, pageSize) {
  let ts = Date.now();
  return "https://mobile.ximalaya.com/mobile/v1/album/track/ts-" + ts + "?albumId=" + albumId + "&device=android&isAsc=" + isAsc + "&isQueryInvitationBrand=true&pageId=" + pageId + "&pageSize=" + pageSize + "&pre_page=0"
}

class DownloadManage {
  constructor() {
    this.downloadAlbumUrlList = []; // 下载的专辑
    this.downloadAlbumUrl = ''; // 正在下载的专辑目录url
    this.albumId = 0;
    this.albumSourceLength = 0;
    this.downloadSourceList = []; // 专辑中的文件
    this.downloadingTaskCBMap = new Map(); // 对应的回调
    this.downloadingTrackids = new Set(); // 下载中的 trackId
    this.isDownloading = false; // 是否在下载
    this.thread = 5; // 同时下载 5 个
  }

  generateArray(start, end) {
    return Array.from(new Array(end + 1).keys()).slice(start)
  }

  getFileName(trackid, title) {
    return trackid.toString().padStart(this.albumSourceLength.toString().length, '0') + '.' + title + '.m4a';
  }

  async getAllList(albumUrl) {
    let groups = albumUrl.match(/\/([0-9]+)/);
    this.albumId = groups[1];
    const firstUrl = getURL(this.albumId, 1, pagesize);
    console.log('urls: ', firstUrl);
    const { data: { data: { list, maxPageId } } } = await axios.get(firstUrl)
    console.log('getAllList: ', list);
    if (maxPageId > 1) {
      const res = await Promise.all(this.generateArray(2, maxPageId).map(async (pageid) => {
        const url = getURL(this.albumId, pageid, pagesize);
        const { data: { data: { list: rList } } } = await axios.get(url);
        return rList
      }))
      return list.concat(...res);
    }
    return list;
  }

  handleNextTask() {
    if (this.downloadingTrackids.size === 5) return;
    if (this.downloadSourceList.length > 0) {
      this.startDownloadTrackIdTask();
    } else if (this.downloadingTrackids.size === 0) {
      this.downloadNextAlbum();
    }
  }

  startDownloadTrackIdTask() {
    while (this.downloadingTrackids.size < this.thread && this.downloadSourceList.length > 0) {
      const { orderNo, title, trackId } = this.downloadSourceList.shift();
      this.downloadingTrackids.add(trackId);
      const xmlyFile = new XmlyFile({
        trackId,
        name: this.getFileName(orderNo, title),
        savePath: path.join(__dirname, `./download/${this.albumId}`)
      });
      const callBack = ({ statu, message }) => {
        if (statu === -1) {
          console.log('downloadFailed: ', message);
          this.downloadingTrackids.delete(trackId);
          this.handleNextTask();
        } else if (statu === 0) {
          console.log('downloadSucess: ', trackId, title);
          this.downloadingTrackids.delete(trackId);
          this.handleNextTask();
        }
      }
      xmlyFile.subScribeStatu(callBack);
      xmlyFile.startDownLoad();
    }
  }

  async downloadNextAlbum() {
    if (this.isDownloading || this.downloadAlbumUrlList.length === 0 || this.downloadingTrackids.size > 0 || this.downloadSourceList.length > 0) {
      return;
    }
    this.downloadAlbumUrl = this.downloadAlbumUrlList.shift();
    console.log('downloadNextAlbum: ', this.downloadAlbumUrl);
    this.downloadSourceList = await this.getAllList(this.downloadAlbumUrl);
    
    this.albumSourceLength = this.downloadSourceList.length;
    const savePath = path.join(__dirname, `./download/${this.albumId}`);
    fs.exists(savePath, function (exists) {
      if (!exists) {
        fs.mkdir(savePath, () => { })
      }
    })
    this.startDownloadTrackIdTask();
  }

  downloadAlbum(albumUrl) {
    this.downloadAlbumUrlList.push(albumUrl);
    this.downloadNextAlbum();
  }
}

module.exports = new DownloadManage();