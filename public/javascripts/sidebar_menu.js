$("#menu-toggle").click(function(e) {
    e.preventDefault();
    $("#wrapper").toggleClass("toggled");
    
    // Xử lý đặc biệt khi thu gọn sidebar
    if ($("#wrapper").hasClass("toggled")) {
        // Ẩn tất cả submenu
        $('#menu ul').hide();
        
        // Đảm bảo các văn bản trong menu bị ẩn
        $('.sidebar-nav li a span:not(.fa-stack)').css({
            'display': 'none',
            'visibility': 'hidden',
            'width': '0',
            'height': '0',
            'opacity': '0'
        });
        
        // Xử lý icon hiển thị
        $('.sidebar-nav li a').css({
            'text-align': 'center',
            'padding': '10px 0',
            'font-size': '0'
        });
        
        $('.sidebar-nav .fa-stack, .sidebar-nav .fa-stack-1x').css({
            'margin': '0 auto',
            'font-size': '20px',
            'width': '50px',
            'display': 'inline-block',
            'text-align': 'center'
        });
        
        // Đảm bảo width của sidebar
        $('#sidebar-wrapper').css({
            'width': '50px',
            'min-width': '50px',
            'max-width': '50px'
        });
        
        // Điều chỉnh lại page content
        $('#page-content-wrapper').css({
            'margin-left': '50px',
            'width': 'calc(100% - 50px)'
        });
    } else {
        // Khôi phục lại khi mở rộng sidebar
        $('.sidebar-nav li a span:not(.fa-stack)').css({
            'display': '',
            'visibility': '',
            'width': '',
            'height': '',
            'opacity': ''
        });
        
        $('.sidebar-nav li a').css({
            'text-align': '',
            'padding': '',
            'font-size': ''
        });
        
        $('.sidebar-nav .fa-stack, .sidebar-nav .fa-stack-1x').css({
            'margin': '',
            'font-size': '',
            'width': '',
            'display': '',
            'text-align': ''
        });
        
        $('#sidebar-wrapper').css({
            'width': '250px',
            'min-width': '',
            'max-width': ''
        });
        
        $('#page-content-wrapper').css({
            'margin-left': '250px',
            'width': ''
        });
    }
});

$("#menu-toggle-2").click(function(e) {
    e.preventDefault();
    $("#wrapper").toggleClass("toggled-2");
    $('.menu-collapsed').toggleClass("d-none");
});

function ensureDashboardExists() {
    var dashboardExists = false;
    var firstMenuItem = $('#menu li:first-child a');
    if (firstMenuItem.length) {
        dashboardExists = firstMenuItem.text().trim().indexOf('Dashboard') !== -1;
    }
    
    if (!dashboardExists) {
        console.log('Dashboard không tồn tại, thêm vào đầu sidebar');
        
        var dashboardUrl = '/admin/';
        if (window.location.pathname.indexOf('/manager/') !== -1) {
            dashboardUrl = '/manager/';
        } else if (window.location.pathname.indexOf('/employee/') !== -1) {
            dashboardUrl = '/employee/';
        }
        
        var dashboardItem = $('<li><a href="' + dashboardUrl + '"><span class="fa-stack fa-lg pull-left"><i class="fa fa-tachometer fa-stack-1x"></i></span> Dashboard</a></li>');
        $('#menu').prepend(dashboardItem);
    }
    
    $('#menu li:first-child').addClass('active');
}

function initMenu() {
    $('#menu ul').hide();
    
    $('#menu li a').click(function() {
        var checkElement = $(this).next();
        
        if((checkElement.is('ul')) && (checkElement.is(':visible'))) {
            return false;
        }
        
        if((checkElement.is('ul')) && (!checkElement.is(':visible'))) {
            $('#menu ul:visible').slideUp('normal');
            checkElement.slideDown('normal');
            return false;
        }
    });
}

$(document).ready(function() {
    // Ensure Dashboard exists and is first item
    function ensureDashboard() {
        var path = window.location.pathname;
        var dashboardUrl = '/admin/';
        
        // Determine correct dashboard URL based on role
        if (path.startsWith('/manager/')) {
            dashboardUrl = '/manager/';
        } else if (path.startsWith('/employee/')) {
            dashboardUrl = '/employee/';
        }
        
        // Check if Dashboard exists
        var dashboardExists = false;
        var firstMenuItem = $('#menu li:first-child a');
        if (firstMenuItem.length) {
            dashboardExists = firstMenuItem.text().trim().indexOf('Dashboard') !== -1;
        }
        
        // Add Dashboard if it doesn't exist
        if (!dashboardExists) {
            var dashboardItem = $('<li><a href="' + dashboardUrl + '"><span class="fa-stack fa-lg pull-left"><i class="fa fa-tachometer fa-stack-1x"></i></span> Dashboard</a></li>');
            $('#menu').prepend(dashboardItem);
        }
    }
    
    // Initialize menu state
    $('#menu ul').hide();
    ensureDashboard();
    
    // Handle menu item clicks
    $('#menu li a').click(function(e) {
        var $this = $(this);
        var href = $this.attr('href');
        var hasSubmenu = $this.next('ul').length > 0;
        
        ensureDashboard(); // Ensure Dashboard exists before any action
        
        // Handle submenu toggles
        if (hasSubmenu) {
            e.preventDefault();
            e.stopPropagation();
            var submenu = $this.next('ul');
            
            // Toggle submenu
            if (submenu.is(':visible')) {
                submenu.slideUp('normal');
            } else {
                $('#menu ul:visible').slideUp('normal');
                submenu.slideDown('normal');
            }
            
            // Update active states
            if (!$this.closest('li').hasClass('active')) {
                $('#menu li:not(:first-child)').removeClass('active');
                $('#menu li a:not(:first)').removeClass('active');
                $this.addClass('active');
                $this.parent('li').addClass('active');
            }
            return false;
        }
        // Handle regular menu items (not modal triggers or toggles)
        else if (href && href !== '#' && !$this.attr('onclick')) {
            // Keep Dashboard's active state separate
            var isDashboard = $this.closest('li').is(':first-child');
            
            if (!isDashboard) {
                $('#menu li:not(:first-child)').removeClass('active');
                $('#menu li a:not(:first)').removeClass('active');
            }
            
            // Add active class to clicked item
            $this.addClass('active');
            $this.parent('li').addClass('active');
            
            // If this is a submenu item, keep parent active
            var parentUl = $this.closest('ul');
            if (parentUl.hasClass('nav-stacked') && !parentUl.is('#menu')) {
                parentUl.parent('li').addClass('active');
            }
        }
    });
    
    // Set initial active state based on current URL
    function setActiveMenuItem() {
        var path = window.location.pathname;
        ensureDashboard(); // Ensure Dashboard exists
        
        // Reset all active states except Dashboard
        $('#menu li:not(:first-child)').removeClass('active');
        $('#menu li a:not(:first)').removeClass('active');
        
        var found = false;
        
        // First try to find exact match
        $('#menu li a').each(function() {
            var href = $(this).attr('href');
            if (href && href !== '#' && !$(this).attr('onclick') && path === href) {
                $(this).addClass('active');
                $(this).parent('li').addClass('active');
                
                // Handle submenu items
                var parentUl = $(this).closest('ul');
                if (parentUl.hasClass('nav-stacked') && !parentUl.is('#menu')) {
                    parentUl.show();
                    parentUl.parent('li').addClass('active');
                }
                found = true;
                return false;
            }
        });
        
        // If no exact match, try partial match
        if (!found) {
            $('#menu li a').each(function() {
                var href = $(this).attr('href');
                if (href && href !== '#' && !$(this).attr('onclick') && path.startsWith(href) && href !== '/') {
                    $(this).addClass('active');
                    $(this).parent('li').addClass('active');
                    
                    // Handle submenu items
                    var parentUl = $(this).closest('ul');
                    if (parentUl.hasClass('nav-stacked') && !parentUl.is('#menu')) {
                        parentUl.show();
                        parentUl.parent('li').addClass('active');
                    }
                    found = true;
                    return false;
                }
            });
        }
        
        // For root paths, activate Dashboard
        if (!found && (path === '/' || path === '/admin/' || path === '/manager/' || path === '/employee/')) {
            $('#menu > li:first-child > a').addClass('active');
            $('#menu > li:first-child').addClass('active');
        }
    }
    
    // Set initial active state
    setActiveMenuItem();
    
    // Handle sidebar toggle
    $("#menu-toggle, #menu-toggle-2").click(function(e) {
        e.preventDefault();
        e.stopPropagation();
        var isSecondToggle = $(this).attr('id') === 'menu-toggle-2';
        
        $("#wrapper").toggleClass(isSecondToggle ? "toggled-2" : "toggled");
        if (isSecondToggle) {
            $('.menu-collapsed').toggleClass("d-none");
        }
        
        if ($("#wrapper").hasClass("toggled") || $("#wrapper").hasClass("toggled-2")) {
            $('#menu ul').hide();
        }
        
        ensureDashboard(); // Ensure Dashboard exists after toggle
    });
    
    // Fix for modals
    $('.modal').on('show.bs.modal hide.bs.modal', function(e) {
        e.stopPropagation();
        ensureDashboard(); // Ensure Dashboard exists when showing/hiding modals
    });
    
    // Watch for DOM changes
    if (typeof MutationObserver !== 'undefined') {
        var observer = new MutationObserver(function(mutations) {
            ensureDashboard();
        });
        
        observer.observe(document.getElementById('menu'), {
            childList: true,
            subtree: true
        });
    }
});