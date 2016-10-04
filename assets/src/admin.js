jQuery(function($){

	//day picker
	$('select#day').change(function(){
		var val = $(this).val();
		var $time = $('input#time');
		var $end_time = $('input#end_time');
		if (val) {
			$time.removeAttr('disabled');
			$end_time.removeAttr('disabled');
			if (!$time.val() && $time.attr('data-value')) $time.val($time.attr('data-value'));
			if (!$end_time.val() && $end_time.attr('data-value')) $end_time.val($end_time.attr('data-value'));
		} else {
			$time.attr('data-value', $time.val()).val('').attr('disabled', 'disabled');
			$end_time.attr('data-value', $end_time.val()).val('').attr('disabled', 'disabled');
		}
	});
	
	//timepicker
	$('input.time').timepicker();
	
	//auto-suggest end time
	$('input#time').change(function(){
		var parts = $(this).val().split(':');
		if (parts.length !== 2) return;
		var hours = parts[0] - 0;
		hours = (hours == 23) ? 0 : hours + 1;
		hours += '';
		if (hours.length == 1) hours = '0' + hours;
		$('input#end_time').val(hours + ':' + parts[1]);
	});
	
	//types checkboxes: ensure not both open and closed
	$('body.post-type-meetings form#post').on('change', 'input[name="types[]"]', function() {
		if ($('body.post-type-meetings form#post input[name="types[]"][value="C"]').prop('checked') && 
			$('body.post-type-meetings form#post input[name="types[]"][value="O"]').prop('checked')) {
			if ($(this).val() == 'C') {
				$('body.post-type-meetings form#post input[name="types[]"][value="O"]').prop('checked', false);
			} else {
				$('body.post-type-meetings form#post input[name="types[]"][value="C"]').prop('checked', false);
			}
		}
	});
	
	//delete email contact
	$('#get_feedback table span').click(function(){
		$(this).parent().submit();
	});

	//location typeahead
	var locations = new Bloodhound({
		datumTokenizer: Bloodhound.tokenizers.obj.whitespace('value'),
		queryTokenizer: Bloodhound.tokenizers.whitespace,
		prefetch: {
			url: myAjax.ajaxurl + '?action=location_autocomplete',
			cache: false
		}
	});
	locations.initialize();
	$('input#location').typeahead(null, {
		displayKey: 'value',
		source: locations.ttAdapter()
	}).on('typeahead:autocompleted', function($e, datum){
		$('input[name=formatted_address]').val(datum.formatted_address);
		$('input[name=latitude]').val(datum.latitude);
		$('input[name=longitude]').val(datum.longitude);
		$('select[name=region] option[value=' + datum.region + ']').prop('selected', true);
		$('textarea[name=location_notes]').val(datum.notes);
		setMap(datum.latitude, datum.longitude);
	});

	//group typeahead
	var groups = new Bloodhound({
		datumTokenizer: Bloodhound.tokenizers.obj.whitespace('value'),
		queryTokenizer: Bloodhound.tokenizers.whitespace,
		prefetch: {
			url: myAjax.ajaxurl + '?action=tsml_group',
			ttl: 10
		}
	});
	groups.initialize();
	$('input#group').typeahead(null, {
		displayKey: 'value',
		source: groups.ttAdapter()
	}).on('typeahead:autocompleted', function($e, datum){
		$('input[name=contact_1_name]').val(datum.contact_1_name);
		$('input[name=contact_1_email]').val(datum.contact_1_email);
		$('input[name=contact_1_phone]').val(datum.contact_1_phone);
		$('input[name=contact_2_name]').val(datum.contact_2_name);
		$('input[name=contact_2_email]').val(datum.contact_2_email);
		$('input[name=contact_2_phone]').val(datum.contact_2_phone);
		$('input[name=contact_3_name]').val(datum.contact_3_name);
		$('input[name=contact_3_email]').val(datum.contact_3_email);
		$('input[name=contact_3_phone]').val(datum.contact_3_phone);
		$('textarea[name=group_notes]').val(datum.notes);
	});

	/*timepicker
	$('input[type=time]').timepicker({
		timeFormat: 'hh:mm tt',
		stepMinute: 15
	});*/
	
	$('input#group').change(function(){
		$('div#group .apply_group_to_location').removeClass('hidden');
	});

	$('form#post').submit(function(){
		if (!$('select#day').val()) {
			$('input#time').val(''); //double check is empty
			return true; //by appointment, don't check time
		}
		var timeVal = $('input#time').val();
		var errors = false;
		if (timeVal.length != 5) errors = true;
		if (timeVal.indexOf(':') != 2) errors = true;
		var hours = timeVal.substr(0, 2);
		var minutes = timeVal.substr(3, 2);
		if (isNaN(hours) || hours < 0 || hours > 23) errors = true;
		if (isNaN(minutes) || minutes < 0 || minutes > 59) errors = true;
		if (errors) {
			alert('Time should be 24-hour format HH:MM.');
			return false;
		}
		return true;
	});

	//address / map
	$('input#formatted_address').blur(function(){

		//setting new form
		$('input#latitude').val('');
		$('input#longitude').val('');

		var val = $(this).val().trim();
		
		if (!val.length) {
			setMap();
			$('input#formatted_address').val(''); //clear any spaces
			return;
		}

		jQuery.getJSON('https://maps.googleapis.com/maps/api/geocode/json', { address: val, key: myAjax.google_api_key }, function(data){

			//check status first, eg REQUEST_DENIED, ZERO_RESULTS
			if (data.status != 'OK') return;
						
			var google_overrides = jQuery.parseJSON(myAjax.google_overrides);
			
			//check if there is an override, because the Google Geocoding API is not always right
			var address = (typeof google_overrides[data.results[0].formatted_address] == 'undefined') ? {
				formatted_address: data.results[0].formatted_address,
				latitude: data.results[0].geometry.location.lat,
				longitude: data.results[0].geometry.location.lng
			} : address = google_overrides[data.results[0].formatted_address];
			
			//set lat + lng
			$('input#latitude').val(address.latitude);
			$('input#longitude').val(address.longitude);
			setMap(address.latitude, address.longitude);

			//guess region if not set
			var region_id = false;
			if (!$('select#region option[selected]').length) {
				console.log($('select#region option[selected]').length);
				$('select#region option').each(function(){
					var region_name = $(this).text().replace('&nbsp;', '').trim();
					if (address.formatted_address.indexOf(region_name) != -1) region_id = $(this).attr('value');
				});
			}
			
			//save address
			$('input#formatted_address').val(address.formatted_address);
			
			//check if location with same address is already in the system, populate form
			jQuery.getJSON(myAjax.ajaxurl + '?action=address', { formatted_address: address.formatted_address }, function(data){
				if (data) {
					$('input[name=location]').val(data.location);
					if (data.region != $('select[name=region]').val()) {
						$('select[name=region] option').prop('selected', false);
						$('select[name=region] option[value=' + data.region + ']').prop('selected', true);
					}
					$('textarea[name=location_notes]').val(data.location_notes);
				}
				
				if ((!data || !data.region) && !$('select#region option[selected]').length && region_id) {
					//set to guessed region earlier
					$('select[name=region] option[value=' + region_id + ']').prop('selected', true);
				}
			});

		});
	});

	if ($('input#formatted_address').val()) $('input#formatted_address').blur();

	function setMap(latitude, longitude) {
		if (!latitude || !longitude) {
			$('div#map').html('');
			return;
		}
		var myLatlng = new google.maps.LatLng(latitude, longitude);
		var map = new google.maps.Map(document.getElementById('map'), { 
			zoom: 16, 
			zoomControl: false,
			scrollwheel: false,
			streetViewControl: false,
			mapTypeControl: false,
			center: myLatlng
		});
		var marker = new google.maps.Marker({ position: myLatlng, map: map });
	}
	
});