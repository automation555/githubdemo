package javacodechecker;

import org.springframework.data.jpa.repository.Query;
import org.springframework.transaction.annotation.Transactional;

class Demo {
	@Transactional
	public class UserRepository {
		// EMB-ISSUE: CodeIssueNames.READ_ONLY_TRANSACTION
		@Query("select username from users")
		public List getAllUsers() {
		}
	}
	
	@Transactional(readOnly=true)
	public class UserRepositoryNoDetect {
		// EMB-ISSUE: CodeIssueNames.READ_ONLY_TRANSACTION/no-detect
		@Query("select username from users")
		public List getAllUsers() {
		}
	}
}