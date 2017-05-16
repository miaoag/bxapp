/**
 * 服务端方法调用
 */
define('app/api',['jquery','store','app/digests'],function($,STORE,DIGESTS) {
	$.support.cors = true;//ie9必须
	//常量定义
	var _rp_token = "rp_token"; //服务端token名称,服务端验证header中的token名称
	var _user_name = "loginname";//服务端用户登陆名称,header中的名称

	var _us_token = "rsToken";//服务端返回token名称,user对象的getRsToken

	var _login_url = "login";//获取服务端user对象的URL
	var _dict_srv_url = "system/dict/query/";//服务端字典数据获取URL
	var _stmid_map_url = "app/common/selectMapByStmID";//服务端根据sqlmapper ID获取map数据URL
	var _stmid_list_url = "app/common/selectArrayByStmID";//服务端根据sqlmapper ID获取List数据URL
	var _stmid_maplist_url = "app/common/selectMapListByStmID";//服务端根据sqlmapper ID获取mapList数据URL,需要在param中指定key

	var _key_user = "_LOCAL_USER_";//本地缓存中user的key
	var _key_dict = "_DICT_CODE_";//本地缓存中dict的key

	if(! ('API' in window) ){
		window['API'] = {
			"dict" : {},
			"DATA" : "data",//ajax返回json数据对象{"data":[{},{}]}
			"MSG" : "message",
			"STATUS" : "status",
			"OK" : "seccuss",
			"FAIL" : "fail",
			"ERROR" : "error",
			"WORN" : "warning",
			"EXCEPTION" : "exception",
			"ctx" : _ctx,
			"srv" : _srv_url,
			"stmidListUrl" : _stmid_list_url,
			"stmidMapUrl" : _stmid_map_url,
			"stmidMapListUrl" : _stmid_maplist_url,
			"http" : {
				/** 200请求成功 */
				"OK" : {"status":"200","message":"处理成功"},
				/** 207频繁操作 */
				"MULTI_STATUS" : {"status":"207","message":"操作频繁"},
				/** 303登录失败 */
				"LOGIN_FAIL" : {"status":"303","message":"登录失败"},
				/** 400请求参数出错 */
				"BAD_REQUEST" : {"status":"400","message":"请求参数错误"},
				/** 401没有登录 */
				"UNAUTHORIZED" : {"status":"401","message":"登陆过期失效"},
				/** 403没有权限 */
				"FORBIDDEN" : {"status":"403","message":"未授权操作"},
				/** 404找不到页面 */
				"NOT_FOUND" : {"status":"404","message":"页面不存在"},
				/** 408请求超时 */
				"REQUEST_TIMEOUT" : {"status":"408","message":"请求超时"},
				/** 500服务器出错 */
				"SERVER_ERROR" : {"status":"500","message":"服务器系统错误"}
			},
			"defaultError" : function(error,status){
				_sysError('系统错误['+status+']',error[API.MSG]);
			},
			"getLocalData" : function(key, callback) {
				var data = STORE.get(key);
				if (typeof callback === "function") {
					callback.call(this,data);
				}else{
					return data;
				}

			},
			"setLocalData" : function(key, data) {
				STORE.set(key, data);
			},
			"clearLocalData" : function() {
				STORE.clearAll();
			},
			"removeLocalData" : function(key) {
				STORE.remove(key);
			},
			"logout" : function(){
				STORE.remove(_key_user);
			},
			createHeader : _create_header,
			ajax : _ajax,
			localUser : _local_user,
			storeUser : _store_user,
			showLogin : _showLogin
		}
	}


	function _sysError(title,msg){
		require(['jquery/gritter'],function(){
			$.gritter.add({
				text: msg,
				title : title,
				sticky: false,
				time: '5000',
				class_name: 'gritter-error'
			});
		})
	}
	function _local_user(){
		return API.getLocalData(_key_user);
	}
	function _store_user(u){
		API.setLocalData(_key_user,u);
	}
	function _create_header(url,request,errorback){
		if(_is_local_data) return true;//本地数据模式
		
		var _user = _local_user();
		if(_user == null || _user == undefined){
			if(typeof errorback === 'function') errorback(API.http.UNAUTHORIZED,API.http.UNAUTHORIZED.status);
			else API.defaultError(API.http.UNAUTHORIZED,API.http.UNAUTHORIZED.status)
			return false;
		}
		request.setRequestHeader(_user_name,_user[_user_name]);
		request.setRequestHeader(_rp_token,DIGESTS.hex_hmac_sha256(_user[_us_token], encodeURI(url)));
		return true;
	}
	function _showLogin(url,data,type,isSync,callback,errorback){
		require(['bootstrap','app/form'],function(){
			if($('#sys-login').length > 0){
        		$('#sys-login').modal('show');
        	}else{
        		$.ajax({
    	            type: "GET",
    	            cache: false,
    	            url: "login-pop.html",
    	            dataType: "html",
    	            success: function(html) {
    	            	$('body').append(html);
    					$('#sys-login').modal('show');
    	            	$('#sys-login').on('hide.bs.modal', function () {
    	            		$('#sys-login').remove();
               		 	});
    	            	_initLoginForm(url,data,type,isSync,callback,errorback);
    	            },
    	            error: function(xhr, ajaxOptions, thrownError) {
    	            	_sysError("登陆页面加载错误["+xhr.status+"]",xhr.statusText);
    	            }
    	        });
        	}
			
		})
	}
    function _initLoginForm(url,data,type,isSync,callback,errorback){
    	var local_user = _local_user();
    	if(local_user != null && _local_user != undefined) {
    		document.forms['login-form'].loginname.value = local_user[_user_name];
    	}
    	$('form.login-form').initForm({
        	headers : {},
        	rules:{
				"loginname":{"messages":{"required" : "请输入用户名"}},
				"password":{"messages":{"required" : "请输入密码"}}
			},
        	beforeSubmit : function(formData, jqForm, options){
        		$('.login-form .alert-danger').remove();
        		$(".login-form button[type='submit']").attr("disabled","true").text("登录中..");
        		options.url = (options.url + "/" + formData[0].value);
        		return true;
        	},
        	success:function(response, status){
        		$(".login-form button[type='submit']").removeAttr("disabled").text("登录");
        		if(response.ERROR){
        			$('.login-form').prepend("<div class='alert alert-danger'>" +
        					"<button class='close' type='button' data-dismiss='alert'>×</button>" +
        					"<span></span>"+response[API.MSG]+"</div>");
        		}else{
        			API.storeUser(response);
        			$('#sys-login').modal('hide');
        			if(url != undefined && url != null)_ajax(url,data,type,isSync,callback,errorback);
        			else if(typeof callback == 'function') callback(response);
        		}
        		
        	},
        	error:function(err){
        		$(".login-form button[type='submit']").removeAttr("disabled").text("登录");
        		$('.login-form').prepend("<div class='alert alert-danger'>" +
    					"<button class='close' type='button' data-dismiss='alert'>×</button>" +
    					"<span></span>系统错误，无法连接服务器</div>");
        	}
        });
    }
	/**
	 * json数据提交,服务器端接收JSON格式的对象
	 * @param  {String} url 提交url
	 * @param  {Boolean} isSync 是否同步
	 * @param  {Function} callback 成功回调函数
	 * @param  {Function} errorback 失败回调函数
	 */
	function _ajax(url,data,type,isSync,callback,errorback,indexLogin){
		var _url = API.ctx + url;
		var _errorback = errorback || API.defaultError;
		if(_is_local_data) {//本地数据以json形式存在
			var _local_url = _srv_url + url;
			if(_local_url.indexOf(".json") != (_local_url.length -5)) _local_url += ".json";
			return API.localData(_local_url,isSync,callback,_errorback);
		}
		var async = true;
		if(isSync != undefined || isSync != null) async = isSync;
		var retData;
		$.ajax({ 
			type:type, 
			//url: _ctx+((url.indexOf("?") >0) ? (url.split("?")[0]+".json?" + url.split("?")[1]) : url+".json"), 
		    url : _srv_url + _url,
			contentType : 'application/json;charset=utf-8',
		    data: JSON.stringify(data),
		    async:async,
		    beforeSend : function(request){
		    	return _create_header(_url,request,_errorback);
			},
		    success:function(ret,status){
		    	if(ret.ERROR){
		    		if(ret[API.STATUS] == API.http.UNAUTHORIZED.status && indexLogin === undefined){
		    			_showLogin(url,data,type,isSync,callback,_errorback);
						return;
		        	}
					retData = ret;
					_errorback(ret,ret[API.STATUS]);
		    	}else{
		    		if(typeof callback === 'function'){
			    		callback(ret,status);
			        }else{
			        	retData = ret;
			        }
		    	}
		    },
		    error:function(xhr,status,error){
		    	//后端异常以全局处理,前端跨域无法处理后端异常
		    	console.error(xhr);
				_sysError("系统错误["+xhr[API.STATUS]+"]","服务网络异常!!");
		    }
		});
		return retData;  
	}

	API.postJson = function(url,param,isSync,callback,errorback){
		return _ajax(url,param,'POST',isSync,callback,errorback);  
	}
	API.callSrv = function(url,param,callback,errorback){
		return API.postJson(url,param,true,callback,errorback);  
	}
	API.getJson = function(url,param,isSync,callback,errorback){
		return _ajax(url,param,'GET',isSync,callback,errorback);  
	}
	API.jsonData = function(url,param){
		var _data;
		this.postJson(url,param || {},false,function(ret){
			_data = ret;
		});
		return _data;
	}
	/*
	 * 获取本地缓存user，如不存在则进行错误处理或者显示登陆pop页面
	 */
	API.getUser = function(callback,errorback){
		var _user = _local_user();
		if(_user == null || _user == undefined){
			if(typeof errorback == "function") errorback(API.http.UNAUTHORIZED,API.http.UNAUTHORIZED.status);
			else _showLogin(null,null,null,null,callback,errorback);
			return null;
		}else{
			return _user;
		}
		
	}
	//首页获取user
	API.getLoginUser = function(callback,errorback){
		if(_is_local_data){
			return _ajax(_login_url+"/"+_local_user_name,{},'GET',true,function(user){
				_store_user(user);
				if(typeof callback == "function") callback(user);
			},function(err,status){
				if(typeof errorback == "function") errorback(err,status);
			},true);
		}else{
			var _user = _local_user();
			if(_user == null || _user == undefined){
				if(typeof errorback == "function") errorback(API.http.UNAUTHORIZED,API.http.UNAUTHORIZED.status);
				return null;
			}else{
				return _ajax(_login_url+"/"+_user[_user_name],{},'POST',true,function(user){
					_store_user(user);
					if(typeof callback == "function") callback(user);
				},function(err,status){
					if(typeof errorback == "function") errorback(err,status);
				},true);
			}
		}
		
		
		
	}
	//以json结尾避免stmid中的.号造成数据丢失
	/*
	 * 根据后端sqlmap ID获取数据
	 */
	API.getMapByStmId = function(stmid,param){
		return API.jsonData(_stmid_map_url+"/"+stmid+".json",param);
	}
	API.getListByStmId = function(stmid,param){
		return API.jsonData(_stmid_list_url+"/"+stmid+".json",param);
	}
	API.getMapListByStmId = function(stmid,param){
		return API.jsonData(_stmid_maplist_url+"/"+stmid+".json",param);
	}
	/*
	 * 根据类型获取后端字典数据,本地缓存
	 */
	API.getDictByType = function(type){
		var _dict_local = API.getLocalData(_key_dict);
		if(_dict_local == null || _dict_local == undefined){
			_dict_local = {};
		}
		if(_dict_local[type] == null || _dict_local[type] == undefined){
			_dict_local[type] = API.jsonData(_dict_srv_url+type);
			if($.isArray(_dict_local[type]) && _dict_local[type].length > 0){
				API.setLocalData(_key_dict,_dict_local);
			}
		}
		return _dict_local[type];
	}
	/*
	 * 根据类型获取后端字典数据,转换map类型方便页面判断
	 */
	API.getDictMap = function(type){
		var _dict_array = API.getDictByType(type);
		var _dict_map = {};
		if($.isArray(_dict_array)){
			for(var i=0;i<_dict_array.length;i++){
				_dict_map[_dict_array[i].value] = _dict_array[i].name;
			}
		}
		return _dict_map;
	}
	/*
	 * 根据类型和字典值（value）获取后端字典数据的名称（name）,页面显示字典名称使用
	 */
	API.getDictName = function(type,value){
		var _dict_map = API.getDictMap(type);
		if(_dict_map[value]) return _dict_map[value];
		else return "";
	}
	API.localData = function(url,async,callback,errorback){
		var retData;
		$.ajax({ 
		    url : url,
			contentType : 'application/json;charset=utf-8',
		    async: async ? async : false,
		    cache: !_is_local_data,
		    success:function(ret,status){
		    	retData = ret
		    	if(typeof callback === 'function') callback.call(this,ret);
		    },
		    error:function(xhr,status,error){
		    	console.error(xhr);
		    	_sysError("系统异常",url+"数据不存在");
		    	if(typeof errorback === 'function') errorback.call(this,xhr,status);
		    }
		});
		return retData;  
	}
	/**
	 * 获取功能权限
	 * @param  {String} role 权限前缀 如: sys:role
	 * @return  {Array} 功能数组 如:["sys:role:add","sys:role:update"]
	 */
	API.getPermission = function(role){
		var permissions = API.jsonData("system/permissions/"+_local_user().id+"/"+role);
		//var permissions = ["sys:role:add","sys:role:save","sys:role:delete","sys:role:assignRole"];
		return permissions;
	}
	//本地直接加載所有字典數據
	if(_is_local_data){
		var _dict_local = API.jsonData("dict-map");
		API.setLocalData(_key_dict,_dict_local);
	}
	
	return API;
});

