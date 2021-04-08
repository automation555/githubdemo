package javacodechecker;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Controller;

class Demo {
	
	class UserServiceImpl {
		
	}

	@Controller
	@RequestMapping("/users")
	public class UserController {
		@Autowired
		// EMB-ISSUE: CodeIssueNames.TIGHTLY_COUPLED_CLASS
		UserServiceImpl userServiceImpl;
	}
}