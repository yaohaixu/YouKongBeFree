const { getClientId, getFingerprint } = require("./identity");

const API_BASE = "https://youkong-d5gh4x0ayc29a2187.service.tcloudbase.com";

function normalizePath(path) {
  return String(path || "").startsWith("/") ? path : `/${path}`;
}

function request(path, options = {}) {
  const method = String(options.method || "GET").toUpperCase();
  const headers = {
    "X-YK-Client-Id": getClientId(),
    "X-YK-Fingerprint": getFingerprint(),
    ...(!["GET", "HEAD", "OPTIONS"].includes(method) ? {
      "Content-Type": "application/json",
      "X-Requested-With": "XMLHttpRequest"
    } : {}),
    ...(options.header || {})
  };

  return new Promise((resolve, reject) => {
    wx.request({
      url: `${API_BASE}${normalizePath(path)}`,
      method,
      data: options.data || {},
      header: headers,
      timeout: options.timeout || 15000,
      success(response) {
        const data = response.data || {};
        if (response.statusCode >= 200 && response.statusCode < 300) {
          resolve(data);
          return;
        }
        const error = new Error(data.error || `请求失败（${response.statusCode}）`);
        error.status = response.statusCode;
        error.data = data;
        reject(error);
      },
      fail(error) {
        reject(new Error(error.errMsg || "没有连接到有空后台服务"));
      }
    });
  });
}

function get(path) {
  return request(path);
}

function post(path, data = {}) {
  return request(path, { method: "POST", data });
}

function put(path, data = {}) {
  return request(path, { method: "PUT", data });
}

function del(path, data = {}) {
  return request(path, { method: "DELETE", data });
}

function upload(path, filePath, formData = {}, options = {}) {
  const method = String(options.method || "POST").toUpperCase();
  const headers = {
    "X-YK-Client-Id": getClientId(),
    "X-YK-Fingerprint": getFingerprint(),
    "X-Requested-With": "XMLHttpRequest",
    ...(options.header || {})
  };

  return new Promise((resolve, reject) => {
    wx.uploadFile({
      url: `${API_BASE}${normalizePath(path)}`,
      filePath,
      name: options.name || "cover",
      formData,
      header: headers,
      timeout: options.timeout || 30000,
      success(response) {
        let data = {};
        try {
          data = response.data ? JSON.parse(response.data) : {};
        } catch (error) {
          reject(new Error("后台返回格式不正确"));
          return;
        }
        if (response.statusCode >= 200 && response.statusCode < 300) {
          resolve(data);
          return;
        }
        const error = new Error(data.error || `请求失败（${response.statusCode}）`);
        error.status = response.statusCode;
        error.data = data;
        reject(error);
      },
      fail(error) {
        reject(new Error(error.errMsg || "上传失败，请稍后再试"));
      }
    });
  });
}

module.exports = {
  API_BASE,
  request,
  get,
  post,
  put,
  del,
  upload
};
