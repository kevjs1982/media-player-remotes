console.debug = function() {};
var roku_images = new Array();
var output = null;
var ssdpData = "";
var ssdpDevices = new Array();
var images_count = 0;
var knownDevices = new Array();

/*
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
			$('#netgem-remote').hide();
			$('#roku_remote').hide();
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

		$('ul').on('click','li',function(){	
			
			$('#selected_device').html(" :: " + ssdpDevices[$(this).data('usn').trim()]['friendlyName'] );
			switch($(this).data('type'))
			{
				case 'urn:dial-multiscreen-org:device:dial:1':
					$('#netgem-remote').hide();
					$('#roku_remote').hide();
					break;
				case 'urn:netgem:device:Netbox:1':
					$('#netgem-remote').show();
					$('#roku_remote').hide();
					break;
				case 'roku:ecp': 
					$('#netgem-remote').hide();
					$('#roku_remote').show();
					var idx = $(this).data('usn');
					//console.log(idx);
					//console.log($("body").find("[data-apps='" + idx + "']").html());
					$('.roku_apps').html($("body").find("[data-apps='" + idx + "']").html());
					break;
			}		
					
			$('#roku_remote_endpoint').val($(this).data('roku'));

		
		});
		
		$('body').on('click','.netgem_dev',function(){	
			$('#netgem_remote_endpoint').val($(this).data('netgem'));

		
		});
		
		
		$('body').on('click','.roku_button',function(){	
			var callurl = $('#roku_remote_endpoint').val() +  $(this).data('action')
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
		for(idx in ssdp_info)
		{
			i = splitWithTail(ssdp_info[idx],":",1);
			me[i[0].trim().toUpperCase()] = (i[1] + "").trim()
		}
		//console.log(me);
		if(typeof ssdpDevices[me['USN']] === 'undefined' && typeof me['LOCATION'] !== 'undefined') 
		{
			// We don't already know about this device,
			// And the device has a location

			me['friendlyName'] = me['LOCATION'];
			me['modelName'] = "";
			me['modelDescription'] = "";
			me['modelNumber'] = "";
			me['manufacturer'] = "";
			me['serialNumber'] = "";
			me['STy'] = "";
			
			switch(me['ST'])
			{
				case 'urn:dial-multiscreen-org:device:dial:1':
					me['STy'] = "DIAL";
					break;
				case 'urn:netgem:device:Netbox:1':
					me['STy'] = "Netgem";
					break;
				case 'roku:ecp': 
					me['STy'] = "Roku";
					break;
			}
			ssdpDevices[me['USN']] = me;
			parseDesc(me['USN']);
		}
        recieveData(socket, sid);
    });
};
function parseDesc(usn)
{
	var url = ssdpDevices[usn]['LOCATION'];
	
	$.ajax({
		  url: url,
		  dataType : 'xml',
		}).done(function(data) {
			
		  //console.log(data);
			ssdpDevices[usn]['URLBase'] = $(data).find('URLBase').text().trim();
			ssdpDevices[usn]['presentationURL'] = $(data).find('presentationURL').text().trim();
			$(data).find('device').each(function()
			{
				var fn = $(this).find('friendlyName').text();
				ssdpDevices[usn]['friendlyName'] = fn.trim();
			//	console.log(ssdpDevices[usn]['friendlyName'])
				//console.log(data);
				ssdpDevices[usn]['manufacturer'] = $(this).find('manufacturer').text().trim();
				ssdpDevices[usn]['modelName'] = $(this).find('modelName').text().trim();
				
				if (ssdpDevices[usn]['URLBase'] == "")
				{
					if (ssdpDevices[usn]['presentationURL'] == "")
					{
						ssdpDevices[usn]['URLBase'] = url;
					}
					else
					{
						ssdpDevices[usn]['URLBase'] = ssdpDevices[usn]['presentationURL'];
					}
				}
				if (ssdpDevices[usn]['modelName'] == 'Eureka Dongle' && ssdpDevices[usn]['manufacturer'])
				{
					ssdpDevices[usn]['modelName'] = "Chromecast";
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
			}
			);
			
			$(data).find('icon').each(function()
			{
				
				ssdpDevices[usn]['icon'] = ssdpDevices[usn]['URLBase'].replace(/\/+$/,'') + $(this).find('url').text();
				//console.log(ssdpDevices[usn]['icon'])
			}
			);
			ssdpDevices[usn]['goRender'] = true;
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
		
		
		
		out = ""
		out += "<li data-usn='"+idx+"' data-type='"+ssdpDevices[idx]['ST']+"' data-roku='"+ssdpDevices[idx]['LOCATION']+"' id=''>"+image+"<span class='content'><B class='device_name' >" + ssdpDevices[idx]['friendlyName'] + "</b><br>";
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
            if(res !== 0) {
                throw('cannot bind socket');
                return -1;
            }

            // recieve data
            recieveData(socket, sid);

            // Send SSDP Search x 2
            var buffer = t2ab(MSearchAll);
            for(var i = 0; i < 8; i++)
            {
                socket.sendTo(sid, buffer, SSDPMulticastAddress, SSDPMulticastPort, function(e)
                {
                    if(e.bytesWritten < 0) {
                        throw("an Error occured while sending M-SEARCH : "+e.bytesWritten);
                    }
                });
            }
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