chrome.app.runtime.onLaunched.addListener(function()
{
	/*
	 * Create Web app windows w 680 x 480
	 */
	chrome.app.window.create('ssdp.html', {
		width: 1024,
		height: 600
	});
});
