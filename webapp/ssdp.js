console.debug = function() {};
var roku_images = new Array();
var output = null;
var ssdpData = "";
var ssdpDevices = new Array();
var images_count = 0;
var knownDevices = new Array();
var fire_tv_proxy = "";
var fire_tv_active = "";
var current_fs_api_device = false;
var fs_modes = new Array();
var fsDAB = new Array();
var radio_dns_catalog = new Array();
var radio_player_loaded = false;
var fspresets = new Array();/*
 * This function will be called when this js is loaded.
 */

 function autoGetImage(image)
{
	var xhr = new XMLHttpRequest();
	var img = image
	url = img.data('imagesrc');
	//console.log("get >> "  +url);
	xhr.open('GET', url.trim(), true);
	xhr.responseType = 'blob';
	xhr.onload = function(e) 
	{
		img.attr('src',window.URL.createObjectURL(this.response));
	};
	xhr.send();
	return true;
}

 
function getImage(url,id)
{
	var xhr = new XMLHttpRequest();
	xhr.open('GET', url, true);
	xhr.responseType = 'blob';
	xhr.onload = function(e) 
	{
		var img = document.createElement('img');
		img.src = window.URL.createObjectURL(this.response);
		document.getElementById(id).appendChild(img);
	};
	xhr.send();
	return true;
}

window.addEventListener("load", function()
	{
		output = document.getElementById("output");
		setInterval(function(){ updateFSInfo() }, 3000);
		
		$.ajax({
			url: "/images/roku/devices.xml",
			dataType : 'xml',
		}).done(function(data) 
		{
			$(data).find('device').each(function()
			{
				roku = $(this);
				roku_images[roku.attr('prefix')] = "/images/roku/" + roku.attr('image') + ".png";
			})
			$('#fs_remote').hide();
			$('#netgem-remote').hide();
			$('#roku_remote').hide();
			$('#fire_remote').hide();
			$('#fire_proxy').hide();
			//console.log(roku_images);
			ssdpStart();
		});

		

		$('#remote_control').on('click','area',function(e)
		{		
			e.preventDefault();
			var button = $(this).data('action');
			var ep = $('#roku_remote_endpoint').val().split("/"); 	
			var url = ep[0] + "//" + ep[2]
			if (button == "vol_down")
			{
				$.ajax(
				{
					type:'POST',
					url: url + '/RemoteControl/Volume/get',
					dataType : 'json',
				}).done(function(reply) 
				{
					level = reply.volume - 7;
					if (level <0)
					{
						level = 0;
					}	
					$.ajax({
						type:'POST',
						url: url + '/RemoteControl/Volume/set?volume='+level,
						dataType : 'json',
					})
				});
			}
			else if(button == "vol_up")
			{
				$.ajax(
				{
					type:'POST',
					url: url + '/RemoteControl/Volume/get',
					dataType : 'json',
				}).done(function(reply) 
				{
					level = reply.volume + 7;
					if (level >100)
					{
						level = 100;
					}	
					$.ajax({
						type:'POST',
						url: url + '/RemoteControl/Volume/set?volume='+level,
						dataType : 'json',
					});
				});
			}
			else
			{
				$.ajax({
					type:'POST',
					url: url +'/RemoteControl/KeyHandling/sendKey?avoidLongPress=1&key='+button,
					dataType : 'json',
				});
			}
		});

		
		
		$('body').on('click','.roku_app_button',function(){	
			$.ajax({
			type:'POST',
				url: $(this).data('url'),
			dataType : 'xml',
			})
		});

		$('ul#devices').on('click','li',function(){	
			
			$('#selected_device').html(" :: " + ssdpDevices[$(this).data('usn').trim()]['friendlyName'] );
			//console.log($(this).data('type'));
			var devtype = $(this).data('type');
			
			if (devtype.indexOf("urn:schemas-frontier-silicon-com")>=0 && devtype.indexOf("fsapi:1")>=0)
			{
				devtype = "frontiersilicon";
				current_fs_api_device = $(this).data('usn').trim();
			}
			else
			{
				current_fs_api_device = false;
			}
			switch(devtype)
			{
				case 'frontiersilicon':
					$('#netgem-remote').hide();
					$('#roku_remote').hide();
					$('#fire_remote').hide();
					$('#fire_proxy').hide();
					$('#fs_remote').show();
					if (radio_player_loaded == false)
					{
						// Radio Player's SI Catalogue contains details for lots of stations which don't have Radio EPG themselves.
						radio_player_loaded = true;
						var si = "http://us.cdn.radioplayer.org/radiodns/spi/3.1/SI.xml";
						$.ajax(
						{
							url: si,
							dataType : 'xml'
						}).done(function(data)
						{
							$(data).find('service').each(function()
							{
								var service = $(this);
								$(this).find('bearer').each(function()
								{
									radio_dns_catalog[$(this).attr('id')] = service;
								});
							})
						})
					}
					
					var usn = $(this).data('usn').trim();
					$.ajax({
						url: fsapi(usn,'netRemote.sys.caps.validModes','LIST_GET_NEXT',false,-1,30),
						dataType : 'xml',
					}).done(function(data)
					{
						//$(data).find('URLBase').text().trim();
						//console.log(data);
						var props = new Array();
						$(data).find('item').each(function()
						{
							var key = $(this).attr('key');
							props[key] = new Array();
							var text = "";
							//console.log($(this).attr('key'));
							$(this).find('field').each(function()
							{
								if ($(this).attr('name') == 'label')
								{
									//props[key]['name'] = $(this).attr('name');// = new Array();
									//console.log(">>" + $(this).attr('name'));	
									text = text == "" ? $(this).find('c8_array').text() : text;
									text = text == "" ? $(this).find('u8').text() : text;
									text = text == "" ? $(this).find('u16').text() : text;
									props[key]['label'] = text;
								}
								else if ($(this).attr('name') == 'selectable')
								{
									props[key]['selectable'] =  $(this).find('u8').text();
								}
							});
							
							//.find('c8_array').text();		
							//console.log(fn);
						})
						$('#fs_remote_modes').html("");
						$.each(props,function(index,value)
						{
							if (value['selectable'] == 1)
							{
								//console.log(">> " + index + ":" + value['label']);
								//netRemote.sys.mode
								//192.168.6.149/fsapi/SET/netRemote.sys.mode?pin=1234&maxItems=100&value=3
								var li = $('<div>').addClass('fsapi-click').attr('id','fs_mode_'+index).attr('data-fsapi', fsapi(usn,'netRemote.sys.mode','SET',index,false,false) ).text(value['label']).appendTo('#fs_remote_modes');
								
							}
						});
						//console.log(props);
						fs_modes = props;
					});
				break;
				case 'urn:dial-multiscreen-org:device:dial:1':
					$('#netgem-remote').hide();
					$('#fs_remote').hide();
					$('#roku_remote').hide();
					if ($(this).data('type2') == 'FireTV' && fire_tv_proxy != "")
					{
						$('#fire_remote').show();
						fire_tv_active = ssdpDevices[$(this).data('usn').trim()]['URLBase'];
						fire_tv_active = fire_tv_active.replace("http://","").replace("https://","");
						fire_tv_active = fire_tv_active.split(":");
						fire_tv_active = fire_tv_active[0] + "/5555/";
						//console.log(fire_tv_active);
						//URLBase
						//http://systems-shared:8080/keypress/192.168.6.139/5555/19
					}
					else if (fire_tv_proxy == "")
					{$('#fire_remote').show();
						$('#fire_proxy').hide();
					}
					else
					{
						$('#fire_remote').hide();
						$('#fire_proxy').show();
					}
					break;
				case 'urn:netgem:device:Netbox:1':
					$('#netgem-remote').show();
					$('#roku_remote').hide();
					$('#fire_remote').hide();
					$('#fire_proxy').hide();
					$('#fs_remote').hide();
					break;
				case 'roku:ecp': 
					$('#fs_remote').hide();
					$('#netgem-remote').hide();
					$('#roku_remote').show();
					$('#fire_remote').hide();
					$('#fire_proxy').hide();
					var idx = $(this).data('usn');
					//console.log(idx);
					//console.log($("body").find("[data-apps='" + idx + "']").html());
					$('.roku_apps').html($("body").find("[data-apps='" + idx + "']").html());
					break;
				case 'upnp:rootdevice':
					$('#fs_remote').hide();
					$('#netgem-remote').hide();
					$('#roku_remote').hide();
					$('#fire_remote').hide();
					$('#fire_proxy').hide();
					break;
					
			}		
					
			$('#roku_remote_endpoint').val($(this).data('roku'));

		
		});
		
		$('body').on('click','.netgem_dev',function(){	
			$('#netgem_remote_endpoint').val($(this).data('netgem'));
			
		
		});
		$('body').on('click','#fs_remote_modes div',function(){	
			$('#fs_remote_modes div').removeClass('fs_active');		
			$(this).addClass('fs_active');		
		
		});

		$('body').on('click','.fsapi-click',function(){	
		//console.log("Clicked " + $(this).data('fsapi'));
			$.ajax({
				url:$(this).data('fsapi'),
			dataType : 'xml',
			})
		
		});
		
		
		$('body').on('click','#fs_vol_plus',function(){	
		//console.log("Clicked " + $(this).data('fsapi'));
		//<div id="fs_buttons"><div id="fs_vol_minus">Vol-</div><div id="fs_vol_plus"></div></div>
		//netRemote.sys.audio.volume
		
			$.ajax({
				url:fsapi(current_fs_api_device,"netRemote.sys.audio.volume","GET",false,false,false),
			dataType : 'xml',
			})
			.done(function(data){
				cur_vol = parseInt($(data).find('value').find('u8').text());
				$.ajax({
				
					url:fsapi(current_fs_api_device,"netRemote.sys.audio.volume","SET",cur_vol+1,false,false),
					dataType : 'xml',
				})
			});
		//netRemote.sys.audio.volume
		});
		
		$('body').on('click','#fs_vol_minus',function(){	
		//console.log("Clicked " + $(this).data('fsapi'));
		//<div id="fs_buttons"><div id="fs_vol_minus">Vol-</div><div id="fs_vol_plus"></div></div>
		//netRemote.sys.audio.volume
		
			$.ajax({
				url:fsapi(current_fs_api_device,"netRemote.sys.audio.volume","GET",false,false,false),
			dataType : 'xml',
			})
			.done(function(data){
				cur_vol = parseInt($(data).find('value').find('u8').text());
				if ($(data).find('value').find('u8').text() > 0)
				{
					$.ajax({
						url:fsapi(current_fs_api_device,"netRemote.sys.audio.volume","SET",cur_vol-1,false,false),
						dataType : 'xml',
					})
				}
			});
		//netRemote.sys.audio.volume
		});
		
		$('body').on('click','#fs_presets div',function()
		{	
			//console.log("Click Preset");
			var sel_preset = $(this).data('preset');
			var sel_mode = $(this).data('mode');
			//console.log($(this).data('mode') + " vs " + fsDAB['modenum']);
			if ($(this).data('mode') != fsDAB['modenum'])
			{
				console.log("Enable Nav");
					$.ajax(
					{
						url: fsapi(current_fs_api_device,"netremote.nav.state","SET",1,false,false),
						dataType : 'xml',
					}).done(function(data)
					{
						console.log("Switch Waveband");
						$.ajax(
						{
							url: fsapi(current_fs_api_device,'netRemote.sys.mode','SET',sel_mode,false,false),
							dataType : 'xml'
						}).done(function(data) 
						{
							console.log("Queue Preset...");
							setTimeout(function()
							{
								console.log("Select Preset " + sel_preset)
								$.ajax(
								{
									url: fsapi(current_fs_api_device,"netremote.nav.state","SET",1,false,false),
									dataType : 'xml',
								}).done(function(data)
								{
									$.ajax(
									{
										url: fsapi(current_fs_api_device,'netRemote.nav.action.selectPreset','SET',sel_preset,false,false),
										dataType : 'xml'
									})
									.done(function(data){
										console.log("Lock Nav");
										$.ajax(
										{
											
											url: fsapi(current_fs_api_device,"netremote.nav.state","SET",0,false,false),
											dataType : 'xml',
										})	
									})
								})
							},3000);
						})
					});
			}
			else
			{
				console.log("Select Preset 2")
				$.ajax(
					{
						url: fsapi(current_fs_api_device,'netRemote.nav.state','SET',1,false,false),
						dataType : 'xml'
					}).done(function(data) 
					{
						console.log(data)
						console.log(url);
						$.ajax(
						{
							url: fsapi(current_fs_api_device,'netRemote.nav.action.selectPreset','SET',sel_preset,false,false),
							dataType : 'xml'
						})
						.done(function(data){
							console.log(data)
							$.ajax(
							{
								url: fsapi(current_fs_api_device,"netremote.nav.state","SET",0,false,false),
								dataType : 'xml',
							})
							.done(function(data){console.log(data)});
						})
					})
			}
		});
		
		
		$('body').on('click','.roku_button',function(){	
			var callurl = $('#roku_remote_endpoint').val() +  $(this).data('action')
			$.ajax({
			type:'POST',
				url:callurl,
			dataType : 'xml',
			})
		});
		
		$('body').on('click','.fire_button',function(){	
			var callurl = fire_tv_proxy + "/keypress/" + fire_tv_active + $(this).data('action')

			$.ajax({
			type:'POST',
				url:callurl,
			dataType : 'xml',
			})
		});

	});


/*
 * translate text string to arryed buffer
 */
function t2ab(str /* String */)
{
    var buffer = new ArrayBuffer(str.length);
    var view = new DataView(buffer);
    for(var i = 0, l = str.length; i < l; i++)
    {
        view.setInt8(i, str.charAt(i).charCodeAt());
    }
    return buffer;
}

/*
 * translate arrayed buffer to text string
 */
function ab2t(buffer /* ArrayBuffer */)
{
    var arr = new Int8Array(buffer);
    var str = "";
    for(var i = 0, l = arr.length; i < l; i++)
    {
        str += String.fromCharCode.call(this, arr[i]);
    }
    return str;
}

/*
 * This function will be called when upd packet is recieved
 */
var recieveData = function(socket, sid)
{
	//console.info("Replied>>");
    socket.recvFrom(sid, function(recv)
    {
        var data = ab2t(recv.data);
		data = data.replace(/\r\n/g, "|")

        var dt = new Date();
        var tmp = dt + "<br>";
        tmp += recv.address + ":" + recv.port + "<br>";
        tmp += data.replace("|","<br>");
		tmp +=  + "<br><br><hr>";
		
		var ssdp_info = data.split("|");
		var me = new Array();
		me['goRender'] = false;
		me['modelName'] = "";
		me['modelDescription'] = "";
		me['modelNumber'] = "";
		me['manufacturer'] = "";
		me['serialNumber'] = "";
		me['STy'] = "";
		//console.log(ssdp_info);
		for(idx in ssdp_info)
		{
			i = splitWithTail(ssdp_info[idx],":",1);
			if(i[0].trim().toUpperCase() != "")
			{
				me[i[0].trim().toUpperCase()] = (i[1] + "").trim()
			}
		}
		//console.log(ssdpDevices[me['USN']] + " : " + me['LOCATION']);
		if(typeof ssdpDevices[me['USN']] === 'undefined' && typeof me['LOCATION'] !== 'undefined') 
		{
			
			// We don't already know about this device,
			// And the device has a location
			//console.log(me['friendlyName']);
			me['friendlyName'] = me['LOCATION'];
			//console.log("Process >> " + me['friendlyName']);
			switch(me['ST'])
			{
				case 'urn:firecontrol-kjs-me-uk:device:control:1':
					me['STy'] = "Fire TV Control";
					break;
				case 'urn:dial-multiscreen-org:device:dial:1':
					me['STy'] = "DIAL";
					break;
				case 'urn:netgem:device:Netbox:1':
					me['STy'] = "Netgem";
					break;
				case 'roku:ecp': 
					me['STy'] = "Roku";
					me['modelName'] = "Roku";
					break;
				case 'upnp:rootdevice':
					me['STy'] = "Root";
					break;
				default:
					if (me['ST'].indexOf("urn:schemas-frontier-silicon-com")>=0 && me['ST'].indexOf(":fsapi:1")>=0)
					{
						me['STy'] = "Frontier Silicon";
						//console.log("FS : " + me['LOCATION']);	
					}
					else
					{
						//console.error(me['LOCATION'] + me['ST'].indexOf("urn:schemas-frontier-silicon-com") + ":" +  me['ST'].indexOf(":fsapi:1"));	
					}
					//console.log(me);
			}
			
			ssdpDevices[me['USN']] = me;
			parseDesc(me['USN']);
		}
        recieveData(socket, sid);
    });
};
function parseDesc(usn)
{
	//console.log("Parse " + usn);
	//console.info(ssdpDevices[usn]);
	var url = ssdpDevices[usn]['LOCATION'];
	
	$.ajax({
		  url: url,
		  dataType : 'xml',
		}).done(function(data) {
			var okaytorender = true;
			
			
			ssdpDevices[usn]['URLBase'] = $(data).find('URLBase').text().trim();
			ssdpDevices[usn]['presentationURL'] = $(data).find('presentationURL').text().trim();
			
			if (ssdpDevices[usn]['STy'] == "Frontier Silicon")
			{
				$(data).find('netRemote').each(function()
				{
					var fn = $(this).find('friendlyName').text();
					var webfsapi = $(this).find('webfsapi').text();
					var l = ssdpDevices[usn]['LOCATION'].split(":");
					ssdpDevices[usn]['icon'] = "http://" + l[1] + ":8080/icon2.png";
					ssdpDevices[usn]['friendlyName'] = fn.trim();
					ssdpDevices[usn]['manufacturer'] = "Frontier Silicon";
					ssdpDevices[usn]['modelName'] = "";
					ssdpDevices[usn]['webfsapi'] = webfsapi.trim();
				})
				loadFrontier(usn);
				//loadEETV(usn)
			}
			else
			{
				$(data).find('device').each(function()
				{
					var fn = $(this).find('friendlyName').text();
					ssdpDevices[usn]['friendlyName'] = fn.trim();
				//	console.log(ssdpDevices[usn]['friendlyName'])
				//console.info(fn.trim() + " " + url);
				//console.log(data);
					//console.log(data);
					ssdpDevices[usn]['manufacturer'] = $(this).find('manufacturer').text().trim();
					ssdpDevices[usn]['modelName'] = $(this).find('modelName').text().trim();
					
					// We need to filter out rootdevices to leave us only with Kodi's
					if(ssdpDevices[usn]['ST'] == "upnp:rootdevice")
					{
						//console.log(ssdpDevices[usn]);
						ssdpDevices[usn]['goRender'] = true;
						if(ssdpDevices[usn]['modelName'] == 'XBMC Media Center' || ssdpDevices[usn]['modelName'] == 'Kodi')
						{
							ssdpDevices[usn]['STy'] = 'Kodi';
						}
						else
						{
							ssdpDevices[usn]['STy'] = '';
							okaytorender = false;
						}
						
					}
					
					if (ssdpDevices[usn]['STy'] == 'Fire TV Control')
					{
						//console.error(ssdpDevices);
						fire_tv_proxy = ssdpDevices[usn]['URLBase'];
						okaytorender = false;
					}
					
					if (ssdpDevices[usn]['URLBase'] == "")
					{
						if(ssdpDevices[usn]['STy'] == 'Kodi')
						{
							// Kodi uses the UPnP Server as the bases
							ssdpDevices[usn]['URLBase'] = url;
						}
						else if (ssdpDevices[usn]['presentationURL'] == "")
						{
							// As do deives without a presentationURL
							ssdpDevices[usn]['URLBase'] = url;
						}
						else
						{
							// However most devices use the presentationURL as the base if it's specified
							ssdpDevices[usn]['URLBase'] = ssdpDevices[usn]['presentationURL'];
						}
					}
					if (ssdpDevices[usn]['modelName'] == 'Eureka Dongle' && ssdpDevices[usn]['manufacturer'])
					{
						ssdpDevices[usn]['modelName'] = "Chromecast";
					}
					
					if (ssdpDevices[usn]['modelName'] == 'FireTV Stick' && ssdpDevices[usn]['ST'] == 'urn:dial-multiscreen-org:device:dial:1')
					{
						ssdpDevices[usn]['STy'] = 'FireTV';
					}
					
					ssdpDevices[usn]['modelDescription'] = $(this).find('modelDescription').text().trim();
					ssdpDevices[usn]['modelNumber'] = $(this).find('modelNumber').text().trim();
					ssdpDevices[usn]['serialNumber'] = $(this).find('serialNumber').text().trim();
					ssdpDevices[usn]['icon'] = "";
					ssdpDevices[usn]['apps'] = new Array();
					if (ssdpDevices[usn]['ST'] == "roku:ecp")
					{
						Roku.loadApps(usn)
					}
					else if(ssdpDevices[usn]['ST'] == "urn:netgem:device:Netbox:1")
					{
						loadEETV(usn)
					}
					else if(ssdpDevices[usn]['ST'] == "urn:dial-multiscreen-org:device:dial:1")
					{
						loadChromecast(usn)
					}
				}
				);
				
				var w = 0;
				$(data).find('icon').each(function()
				{
					var myw = $(this).find('width').text();
					if (myw > w || w == 0)
					{
						ssdpDevices[usn]['icon'] = ssdpDevices[usn]['URLBase'].replace(/\/+$/,'') + $(this).find('url').text();
						w = myw;
					}
				}
				);
			}
			ssdpDevices[usn]['goRender'] = okaytorender;
			redrawSSDPList(usn);
	});
}

function loadDataImage(id)
{
	try
	{
		//console.log("Load Image >> " + id);
		var remoteImage 
		if (typeof($(id).data('imagesrc'))!=='undefined')
		{
			getImage($(id).data('imagesrc'),id.replace("#",""));
		}
	}
	catch(e)
	{
		
		//console.log("RAL Errored " + id);
		//console.log(e);
	}
}
function loadEETV(usn)
{
	//console.log("EE " + ssdpDevices[usn]['presentationURL'] + '/UPnP/Device/getInfo')
	$.ajax({
		url: ssdpDevices[usn]['presentationURL'] + 'UPnP/Device/getInfo',
		dataType : 'json',
	}).done(function(data) 
	{
		//var ee_clock = new Date(data.system.time)
		//$( "#time" ).html(ee_clock.format('dd-mmm-yyyy HH:MM:ss'));
		//$( "#"+usn.replace(/\:/,"_")+"_disk" ).progressbar({value:data.pvr.status.disk.percent});
		$( "#"+usn.replace(/\:/g,"_")+"_tuners" ).html(data.system.tuners + " tuners.&nbsp;&nbsp;");
		var used = data.pvr.status.disk.usedSpace / 1024 / 1024
		var total = data.pvr.status.disk.totalSpace / 1024 / 1024
		$( "#"+usn.replace(/\:/g,"_")+"_usage" ).html("<i>" + $.number(used,2) + " of " + $.number(total,2) + " GiB used</i>");
	});
}

function loadChromecast(usn)
{
	//console.log(ssdpDevices[usn])
	//console.log("CC " + ssdpDevices[usn]['URLBase'] + '/setup/eureka_info?options=detail')
	$.ajax({
		url: ssdpDevices[usn]['URLBase'] + '/setup/eureka_info?options=detail',
		dataType : 'json',
	}).done(function(data) 
	{
		//console.log(data);
		//var ee_clock = new Date(data.system.time)
		//$( "#time" ).html(ee_clock.format('dd-mmm-yyyy HH:MM:ss'));
		//$( "#"+usn.replace(/\:/,"_")+"_disk" ).progressbar({value:data.pvr.status.disk.percent});
		//$( "#"+usn.replace(/\:/g,"_")+"_tuners" ).html(data.system.tuners + " tuners.&nbsp;&nbsp;");
		//var used = data.pvr.status.disk.usedSpace / 1024 / 1024
		//var total = data.pvr.status.disk.totalSpace / 1024 / 1024
		var snr = data.signal_level - data.noise_level;
		$( "#"+usn.replace(/\:/g,"_")+"_chromecast" ).html(snr2bars(snr) + " " + data.release_track + " " + data.cast_build_revision + " Uptime: " + data.uptime + "</i>");
	});
}
var rdns_topic = false;
var rdns_dns = false;
var rdns_timeout = false;
var rdns_last_lookup = false;
var radio_dns_supported = new Array();
function updateRDNS()
{
	clearTimeout(rdns_timeout);
	//console.log("Fetch rDNS SI");
	if (rdns_dns != rdns_last_lookup)
	{
		$('#fsapi_rdns_status').html("");
		$('#fsapi_rdns').html("");
		$('#fs_rdns_logo').html("");
		rdns_last_lookup = rdns_dns;
		if (typeof(radio_dns_catalog[rdns_dns])=='undefined')
		{
		
			$.ajax({
				url: "http://api.kjs.me.uk/radiodns/dns?topic="+rdns_dns,
				dataType : 'json'
			}).done(function(data)
			{
				//console.log(data);
				if (data.Status == "OK")
				{
					epg = data.RadioEPG.length > 0 ? data.RadioEPG[0].target : "";
					vis = data.RadioVIS.length > 0 ? data.RadioVIS[0].target : "";
					radio_dns_supported[rdns_dns] = {'EPG': epg,'VIS': vis }
					
					if (data.RadioEPG.length > 0)
					{
						var si = "http://" + data.RadioEPG[0].target + ":" + data.RadioEPG[0].port + "/radiodns/spi/3.1/SI.xml";
						console.log(si);
						$.ajax(
						{
							url: si,
							dataType : 'xml'
						}).done(function(data)
						{
							//console.log("Fetched " + si);
							$(data).find('service').each(function()
							{
								var service = $(this);
								$(this).find('bearer').each(function()
								{
									radio_dns_catalog[$(this).attr('id')] = service;
								});
							})
							drawRadioDNS(rdns_dns);
						})
					}
					else
					{
						drawRadioDNS(rdns_dns);
					}
				}
				else
				{
					drawRadioDNS(rdns_dns);
				}
			});
		}
		else
		{
			drawRadioDNS(rdns_dns);
		}
	}
}
function drawRadioDNS(topic)
{
	//console.log(topic);
	
	if (typeof(radio_dns_supported[topic]) != 'undefined')
	{
		epgc = (radio_dns_supported[topic].EPG != "") ? 'green' : 'red';
		visc = (radio_dns_supported[topic].VIS != "") ? 'green' : 'red';
		
		rve = "<span class='"+visc+"'>RadioVIS</span> <span class='"+epgc+"'>RadioEPG</span>";
	}
	else
	{
		rve = "<span class='red'>RadioVIS</span> <span class='red'>RadioEPG</span>";
	}
	$('#fsapi_rdns_status').html(rve);
	bearer = topic.split('.').reverse().join('.').replace('dab.','dab:').replace('fm.','fm:');
	//console.log(radio_dns_catalog);
	if (typeof(radio_dns_catalog[bearer])!=='undefined')
	{
		var rdns = radio_dns_catalog[bearer];
		var logosize = 0;
		var logo = "";
		var longname = rdns.find('longName').text();
		var shortDesc = rdns.find('shortDescription').text();
		if (rdns.find('longDescription').text()!="")
		{
			shortDesc = rdns.find('longDescription').text();
		}
		rdns.find('multimedia').each(function(){
			if ($(this).attr('width') == "320" && $(this).attr('height') == 240)
			{
				logosize = $(this).attr('width') * $(this).attr('height');
				logo = $(this).attr('url');
			}
		})
		var url = rdns.find('radiodns').attr('fqdn');
		//console.log(logo);
		var apre = url == "" ? "" : "<a href='" + url + "'>";
		var asuf = url == "" ? "" : "</a>";
		var outstr = "<b>" + apre + longname + asuf + "</b> - " + shortDesc 
		$('#fs_rdns_logo').data('imagesrc',logo);
		$('#fsapi_rdns').html(outstr);
		loadDataImage('#fs_rdns_logo')
		//fsapi_rdns
	}
	else
	{
		$('#fsapi_rdns').html("");
		$('#fs_rdns_logo').html("");
		/*$('#fsapi_rdns_status').html("");*/
	}
	
}
function launchRadioDNS()
{
	//console.log("Launch RDNS");
	
	
	if ( fsDAB['mode'].toString().toLowerCase() == 'dab' )
	{
		var dabScids = fsDAB['dabScids'] == "" ? "0" : fsDAB['dabScids'];
		var gcc = fsDAB['dabServiceId'].substring(0,1) + fsDAB['ecc'];
		rdns_dns = fsDAB['dabScids'] + "." + fsDAB['dabServiceId'] +"." +fsDAB['dabEnsembleId'] + "." + gcc + "." + fsDAB['mode'].toString().toLowerCase();
		rdns_topic =  fsDAB['mode'].toString().toLowerCase() + "/" + gcc + "/" + fsDAB['dabEnsembleId'] + "/" + fsDAB['dabServiceId'] + "/"+fsDAB['dabScids']+"/";  
		//console.log(rdns_topic);
		//console.log(rdns_dns);
		rdns_timeout = setTimeout(function(){updateRDNS()},1000);
	}
	else if ( fsDAB['mode'].toString().toLowerCase() == 'disabled.fm' )
	{
		var frequency = parseInt(fsDAB['frequency'] / 10);
		frequency = "" + frequency;
		pad = "00000";
		//console.log(fsDAB);
		pad.substring(0, pad.length - frequency.length) + frequency
		//console.log(frequency);
		var gcc = fsDAB['fmRdsPi'].substring(0,1) + fsDAB['ecc'];
		//<frequency>.<pi>.<gcc>.fm.radiodns.org
		rdns_dns = frequency + "." + fsDAB['fmRdsPi'] + "." + gcc + "." + fsDAB['mode'].toString().toLowerCase();
		rdns_topic =  fsDAB['mode'].toString().toLowerCase() + "/" + gcc + "/" + fsDAB['dabEnsembleId'] + "/" + fsDAB['dabServiceId'] + "/"+fsDAB['dabScids']+"/";  
		//console.log(rdns_topic);
		//console.log(rdns_dns);
		rdns_timeout = setTimeout(function(){updateRDNS()},1000);
	}
	else
	{
		$('#fsapi_rdns').html("");
		$('#fs_rdns_logo').html("");
		$('#fsapi_rdns_status').html("");
	}
/*
0.c22b.ce15.ce1.dab

	dab/<ecc>/<eid>/<sid>/<scids>/
dab/ce1/c1ae/c377/0
0.c377.c1ae.e1.dab.radiodns.org
dig 0.c377.c1ae.ce1.dab.radiodns.org
(Note ce1 = eid firsat char. and ecc)
>> 0.c377.c1ae.ce1.dab.radiodns.org. 543 IN CNAME  rdns.musicradio.com.
dig srv _radiovis._tcp.rdns.musicradio.com
>>_radiovis._tcp.rdns.musicradio.com. 3413 IN SRV 0 100 61613 vis.musicradio.com.
dig srv _radioepg._tcp.rdns.musicradio.com
_radioepg._tcp.rdns.musicradio.com. 3600 IN SRV 0 100 80 epg.musicradio.com.
http://epg.musicradio.com/radiodns/spi/3.1/dab/ce1/c1ae/c377/0
http://epg.musicradio.com/radiodns/spi/3.1/SI.xml
>> Look for <bearer cost="20" id="dab:ce1.c1ae.c377.0" mimeValue="audio/mpeg" offset="2500"/>
mode
ecc
dabEnsembleId
dabServiceId
dabScids
fmRdsPi 

*/
}
function parseFSReply(data,slug,field)
{
	//console.log(data);
	//console.log(field);
	var text = "";
	text = text == "" ? $(data).find('value').find('c8_array').text() : text;
	text = text == "" ? $(data).find('value').find('u8').text() : text;
	text = text == "" ? $(data).find('value').find('u16').text() : text;
	text = text == "" ? $(data).find('value').find('u32').text() : text;
	surpresstext = false;
	switch (slug)
	{
		case 'netRemote.play.serviceIds.ecc':
		case 'netRemote.play.serviceIds.dabEnsembleId':
		case 'netRemote.play.serviceIds.dabServiceId':
		case 'netRemote.play.serviceIds.dabScids':
		case 'netRemote.play.serviceIds.fmRdsPi':
			var was = fsDAB[slug.replace('netRemote.play.serviceIds.','')];
			var nowIs = Number(text).toString(16);
			if (was != nowIs)
			{
				clearTimeout(rdns_timeout);
			}
			fsDAB[slug.replace('netRemote.play.serviceIds.','')] = nowIs;
			launchRadioDNS();
			//console.log(fsDAB);
			surpresstext = true;
			break;
		case 'netRemote.sys.mode':
			var fs_waveband = text;
			text = fs_modes[text]['label'];
			var was = fsDAB['mode'];
			fsDAB['mode'] = text;
			fsDAB['modenum'] = fs_waveband;
			var nowIs = text;
			if (was != nowIs)
			{
				clearTimeout(rdns_timeout);
				$('#fs_remote_modes div').removeClass('fs_active');		
				$('#fs_mode_' + fs_waveband).addClass('fs_active');		
				// New Mode, Update Presets
				if (nowIs == 'DAB' || nowIs == 'FM' || nowIs == 'Internet radio')
				{
					//console.error("Update Presets");
					if (typeof(fspresets[fs_waveband])=='undefined')
					{
						setTimeout(function()
						{
							$.ajax(
							{
								url: fsapi(current_fs_api_device,"netremote.nav.state","SET",1,false,false),
								dataType : 'xml',
							}).done(function(data) 
							{
								$.ajax(
								{
									url: fsapi(current_fs_api_device,"netremote.nav.presets","LIST_GET_NEXT",false,-1,40),
									dataType : 'xml',
								}).done(function(data) 
								{
									fspresets[fs_waveband] = new Array()
									$(data).find('item').each(function()
									{
										preset_id = $(this).attr('key');
										preset_name = $(this).find('c8_array').text();
										
										//console.log(fs_waveband + " : " + preset_id + " : " + preset_name); 
										fspresets[fs_waveband][preset_id] = preset_name;
									})
									var out = ""//"<table  class='presetbtn'><tr>";
									var size = 40;
									$.each(fspresets,function(mode,wbpresets)
									{
										if (typeof(fspresets[mode])!='undefined')
										{
											for(i=0;i<size;i++)
											{
												if (fspresets[mode][i] != "")
												{
													out += "<div data-mode='"+mode+"' data-preset='"+i+"'>" + fs_modes[mode]['label'] + "<br><span class='presetname'>" + fspresets[mode][i] + "</span></div>";
												}
											}
										}
									});
									$('#fs_presets').html(out);
									$.ajax(
									{
										url: fsapi(current_fs_api_device,"netremote.nav.state","SET",0,false,false),
										dataType : 'xml',
									})
								});
							});
						},1500);
					}
				}
			}
			launchRadioDNS();
			break;
		case 'netRemote.play.frequency':
			if (text == '4294967295')
			{
				text = "";
			}
			else
			{
				fsDAB['frequency'] = text;
				text = (text / 1000) + "MHz";
				
			}
			break;
		case 'netRemote.play.info.artist':
			drawFsRemoteArtist(text); // Gets Graphics and URIifies it, when changed
			surpresstext = true;
			break;
		case 'netRemote.play.info.album':
			setTimeout(function() { drawFsRemoteAlbum(text); },500);// Gets Graphics and URIifies it, when changed
			surpresstext = true;
			break;
		
		case 'netRemote.play.info.graphicUri':
			//console.log("Graphic : " + text);
			if (text == "")
			{
				$(field).html("");
			}
			else
			{
				if ($(field).data('imagesrc')!=text)
				{
					$(field).data('imagesrc',text);
					$(field).html("");
					loadDataImage(field)
				}
				surpresstext = true;
				break;
			}
	}
	if (surpresstext ==false)
	{
		$(field).html(text);
	}
}
function updateFSInfoField(slug,field)
{
		$.ajax({url: fsapi(current_fs_api_device,slug,'GET',false),
			dataType : 'xml',}).done(function(data) {		parseFSReply(data,slug,field);	});

}
var fs_last_artist = "-1";
var fs_last_album = "-1";
function drawFsRemoteArtist(text)
{
	if (text == fs_last_artist)
	{
		// No Change
	}
	else if(text == "")
	{
		$('#fsapi_artist_box').hide();
		$('#fsapi_artist').html("");
		$('#fsapi_artist_summary').html("");
	}
	else
	{
		$('#fsapi_artist_box').show();
		fs_last_artist = text;
		$('#fsapi_artist').html(text); // Default to sanity
		var artist = encodeURIComponent(text)//.replace(" ","+");
		$.ajax(
				{
					type:'POST',
					url: "http://ws.audioscrobbler.com/2.0/?method=artist.getinfo&artist=" + artist + "&api_key=e3403d4a036a3b1f7cb3519bdd42aa9b&format=json",
					dataType : 'json',
				}).done(function(reply) 
				{
					console.log(reply);
					var image = reply.artist.image[1]['#text'];
					var summary = reply.artist.bio.summary;
					$('#fsapi_artist').html("<a target='_blank' href='"+reply.artist.url+"'>" + text + "</a>");
					$('#fsapi_artist_summary').html(summary);
					$('#fsapi_artist_graphic').html("");
					$('#fsapi_artist_graphic').data('imagesrc',image);
					loadDataImage("#fsapi_artist_graphic");
				})
	}
			
			//text = "<a target='_blank' href='http://www.last.fm/music/" +  text.replace(" ","+") + "'>" + text + "</a>"
			//fsapi_artist
}			
function drawFsRemoteAlbum(text)
{
	var my_artist = fs_last_artist; 
	if (text + "_" + my_artist == fs_last_album)
	{
		// No Change
	}
	else if(text == "")
	{
		$('#fsapi_album_box').hide();
		$('#fsapi_album').html("");
		$('#fsapi_album_summary').html("");
	}
	else
	{
		$('#fsapi_album_box').show();
		fs_last_album = text + "_" + my_artist;
		$('#fsapi_album').html(text); // Default to sanity
		var album = encodeURIComponent(text)//.replace(" ","+");
		var artist = encodeURIComponent(my_artist)//.replace(" ","+");
		$.ajax(
				{
					type:'POST',
					url: "http://ws.audioscrobbler.com/2.0/?method=album.getinfo&artist="+my_artist+"&album=" + album + "&api_key=e3403d4a036a3b1f7cb3519bdd42aa9b&format=json",
					dataType : 'json',
				}).done(function(reply) 
				{
					console.log(reply);
					//var image = reply.album.image[1]['#text'];
					var summary = reply.album.listeners + " listeners, " + reply.album.playcount + " plays <br><small>" + reply.album.wiki.summary + "</small>";
					$('#fsapi_album').html("<a target='_blank' href='"+reply.album.url+"'>" + text + "</a>");
					$('#fsapi_album_summary').html(summary);
					/*$('#fsapi_artist_graphic').html("");
					$('#fsapi_artist_graphic').data('imagesrc',image);
					loadDataImage("#fsapi_artist_graphic");*/
				})
	}
			
			//text = "<a target='_blank' href='http://www.last.fm/music/" +  text.replace(" ","+") + "'>" + text + "</a>"
			//fsapi_artist
}			
function updateFSInfo()
{
	if (current_fs_api_device == false)
	{
	}
	else
	{
		updateFSInfoField('netRemote.sys.mode','#fsapi_mode');
		updateFSInfoField('netRemote.play.info.name','#fsapi_name');
		updateFSInfoField('netRemote.play.info.artist','#fsapi_artist');
		updateFSInfoField('netRemote.play.info.text','#fsapi_text');
		updateFSInfoField('netRemote.play.info.album','#fsapi_album');
		updateFSInfoField('netRemote.play.info.graphicUri','#fs_graphicUri');
		updateFSInfoField('netRemote.play.info.name','#fsapi_name');
		updateFSInfoField('netRemote.play.frequency','#fsapi_frequency');
		
		updateFSInfoField('netRemote.play.serviceIds.ecc','');
		updateFSInfoField('netRemote.play.serviceIds.dabEnsembleId','');
		updateFSInfoField('netRemote.play.serviceIds.dabServiceId','');
		updateFSInfoField('netRemote.play.serviceIds.dabScids','');
		updateFSInfoField('netRemote.play.serviceIds.fmRdsPi','');
		
	/*		<tr><th>Mode</th><td id="fsapi_mode"></td></tr>
					<tr><th>Name</th><td id="fsapi_name"></td></tr>
					<tr><th>Artist</th><td id="fsapi_artist"></td></tr>
					<tr><th>Text</th><td id="fsapi_text"></td></tr>
					<tr><th>Album</th><td id="fsapi_album"></td></tr>
					<tr><th>Graphic</th><td id="fsapi_graphic"></td></tr>
					<tr><th>Radio DNS</th><td id="fsapi_rdns"></td></tr>
					
					
	// Mode
	netRemote.play.info.name 
	netRemote.play.info.artist 
	netRemote.play.info.text 
	netRemote.play.info.album 
	netRemote.play.info.graphicUri 
	//netRemote.play.info.duration 
	//netRemote.play.position 

*/
	}
}


function fsapi(usn,slug,mode,value,offset,maxitems)
{
	
	var offset = (mode=='LIST_GET_NEXT') ? "/" + offset : "";
	var reply = ssdpDevices[usn]['webfsapi'] + "/" + mode + "/" + slug + offset + "?pin=1234";
	if (value !== false)
	{
		reply += "&value=" + value;
	}
	if(mode=='LIST_GET_NEXT' && maxitems != false)
	{
		reply += "&maxItems=" + maxitems;
	}
	return reply;
}
function loadFrontier(usn)
{
	fsDAB['mode'] = "";
	fsDAB['ecc'] = "";
	fsDAB['dabEnsembleId'] = "";
	fsDAB['dabServiceId'] = "";
	fsDAB['dabScids'] = "";
	fsDAB['fmRdsPi'] = "";
	//
			
	

}


function snr2bars(snr)
{
	if (snr > 40)
	{
		return "<img src='/images/wifi/5.png' class='ss'>";
	}
	else if(snr > 33)
	{
		return "<img src='/images/wifi/4.png' class='ss'>";
	}
	else if(snr > 25)
	{
		return "<img src='/images/wifi/3.png' class='ss'>";
	}
	else if(snr > 15)
	{
		return "<img src='/images/wifi/2.png' class='ss'>";
	}
	else if(snr > 10)
	{
		return "<img src='/images/wifi/1.png' class='ss'>";
	}
	else
	{
		return "<img src='/images/wifi/0.png' class='ss'>";
	}
}
var Roku = {

	loadApps : function(usn)
	{
		var idx = usn;
		url = ssdpDevices[idx]['LOCATION'] + "query/apps";
		$.ajax({
				url: url,
				dataType : 'xml',
			}).done(function(data) 
			{
				$(data).find('apps').each(function()
				{
					$(this).find('app').each(function()
					{
						roku = $(this);
						ssdpDevices[idx]['apps'][roku.attr('id')] = roku.text();
					});
				})
				redrawSSDPList(idx);
			});
	},
	dummy : function () {}
}

function redrawSSDPList(usn)
{
	var idx = usn;
	if (ssdpDevices[idx]['STy']!="" )
	{
		image = "";
		image_id = false;
		if ( ssdpDevices[idx]['ST'] == 'roku:ecp' && typeof(roku_images[ssdpDevices[idx]['serialNumber'].substring(0,2)])!=='undefined')
		{
			image = "<img class='rokuimg' src='" + roku_images[ssdpDevices[idx]['serialNumber'].substring(0,2)] + "'>";
		}
		else if(ssdpDevices[idx]['icon'] != "")
		{
			image_id = "icon_" + images_count++;
			image = "<span id='" + image_id + "' class='rokuimg' data-imagesrc='" + ssdpDevices[idx]['icon'] + "'></span>";
		}
		var span = "";
		if ( ssdpDevices[idx]['ST'] == 'urn:netgem:device:Netbox:1')
		{
			span = "<span id='"+idx.replace(/\:/g,"_")+"_disk'></span><span id='"+idx.replace(/\:/g,"_")+"_tuners'></span><span id='"+idx.replace(/\:/g,"_")+"_usage'></span>";
		}
		
		if ( ssdpDevices[idx]['ST'] == 'urn:dial-multiscreen-org:device:dial:1')
		{
			span = "<span id='"+idx.replace(/\:/g,"_")+"_chromecast'></span>";
		}
		
		
		//console.log(ssdpDevices[idx]['friendlyName']);
		out = ""
		out += "<li data-usn='"+idx+"' data-type='"+ssdpDevices[idx]['ST']+"' data-type2='"+ssdpDevices[idx]['STy']+"' data-roku='"+ssdpDevices[idx]['LOCATION']+"' id=''>"+image+"<span class='content'><B class='device_name' >" + ssdpDevices[idx]['friendlyName'] + "</b><br>";
		out += "<i>" + ssdpDevices[idx]['manufacturer'] + " .::. " +ssdpDevices[idx]['modelName'] + " " + ssdpDevices[idx]['modelNumber'] + "</i><br>"
		//out += ssdpDevices[idx]['modelDescription'] + ":" + ssdpDevices[idx]['serialNumber'] + "<br>";
		out += span
		//out += "<a href='" + ssdpDevices[idx]['LOCATION'] + "' target='_blank'>"+ssdpDevices[idx]['LOCATION'] + "</a>";
		out += "<span class='apps_sb' data-apps='"+idx+"'>";
		for(idx2 in ssdpDevices[idx]['apps'])
		{
			var	icon = ssdpDevices[idx]['LOCATION'] + "query/icon/" + idx2;
			out += "<img src='blank.png' class='roku_app_button' data-imagesrc='"+icon+"' data-url='"+ssdpDevices[idx]['LOCATION']+"launch/"+idx2+"'> ";
		}
		out += "</span></span></li>"; 
		$("ul").find("[data-usn='" + idx + "']").remove();
		$("#devices").append(out);
		
		for(idx2 in ssdpDevices[idx]['apps'])
		{
			//out += "<span class='roku_app_button' data-url='"+ssdpDevices[idx]['LOCATION']+"launch/"+idx2+"'>" + ssdpDevices[idx]['apps'][idx2] + "</span>,";
			autoGetImage($("ul").find("[data-url='" + ssdpDevices[idx]['LOCATION']+"launch/"+idx2 + "']"));
		}
		
		
		
		if (image_id!=false)
		{
			loadDataImage("#"+image_id)
		}

		
						var options = {
		  type: "basic",
		  title: "New Media Player Found!",
		  message: ssdpDevices[idx]['friendlyName'],
		  iconUrl: "play.png"
		}
		chrome.notifications.create("ntfn_image_id", options, function() { });				
	}
}

/*
 * This function will be called when "SSDP Start" button is pushed.
 */
var ssdpStart = function()
{
	//console.log("Scan");
    // M-Search packed w/ "ssdp:all"
    var MSearchAll = "M-SEARCH * HTTP/1.1\r\n" +
        "ST: ssdp:all\r\n" +
        "MAN: \"ssdp:discover\"\r\n" +
        "HOST: 239.255.255.250:1900\r\n" +
        "MX: 10\r\n\r\n";
    // chrome socket
    var socket = chrome.socket || chrome.experimental.socket;
    // SSDP multicast address
    var SSDPMulticastAddress = "239.255.255.250";
    // SSDP multicast port
    var SSDPMulticastPort = 1900;
    // socket id
    var sid;

    // create udp socket
    socket.create('udp', {}, function(socketInfo)
    {
        sid = socketInfo.socketId;
        //console.log("socket id: " + sid);
        socket.bind(sid, "0.0.0.0", 0, function(res)
        {
			//console.info("Scan >");
            if(res !== 0) 
			{
				console.error("Cannot bind socket");
                throw('cannot bind socket');
                return -1;
            }

            // recieve data
            recieveData(socket, sid);
			//console.info("Scan >>");
            // Send SSDP Search x 2
            var buffer = t2ab(MSearchAll);
            for(var i = 0; i < 8; i++)
            {
                socket.sendTo(sid, buffer, SSDPMulticastAddress, SSDPMulticastPort, function(e)
                {
                    if(e.bytesWritten < 0) {
                        throw("an Error occured while sending M-SEARCH : "+e.bytesWritten);
						//console.log("an Error occured while sending M-SEARCH : "+e.bytesWritten);
                    }
                });
            }
			//console.info("Scan >>");
        });
    });
	
	setTimeout(ssdpStart,10000);
};
 
 
function splitWithTail(str,delim,count){
  var parts = str.split(delim);
  var tail = parts.slice(count).join(delim);
  var result = parts.slice(0,count);
  result.push(tail);
  return result;
}