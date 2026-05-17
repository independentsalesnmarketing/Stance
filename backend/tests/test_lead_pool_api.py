"""
Backend API Tests for Stance Marketing Lead Pool System
Tests: Admin Auth, Leads CRUD, Agents CRUD, Claim APIs
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestAdminAuth:
    """Admin authentication endpoint tests"""
    
    def test_admin_login_success(self):
        """Test admin login with correct password"""
        response = requests.post(f"{BASE_URL}/api/admin-auth", json={
            "password": "stance2024admin"
        })
        assert response.status_code == 200
        data = response.json()
        assert data.get("ok") == True
        print("SUCCESS: Admin login with correct password")
    
    def test_admin_login_wrong_password(self):
        """Test admin login with wrong password"""
        response = requests.post(f"{BASE_URL}/api/admin-auth", json={
            "password": "wrongpassword"
        })
        assert response.status_code == 401
        data = response.json()
        assert "error" in data
        print("SUCCESS: Admin login rejected with wrong password")


class TestLeadsAPI:
    """Leads API endpoint tests"""
    
    def test_get_leads_list(self):
        """Test GET /api/leads returns list of leads"""
        response = requests.get(f"{BASE_URL}/api/leads")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"SUCCESS: GET /api/leads returned {len(data)} leads")
    
    def test_get_lead_by_id(self):
        """Test GET /api/leads/:id returns a specific lead"""
        # First get list to find an existing lead
        list_response = requests.get(f"{BASE_URL}/api/leads")
        leads = list_response.json()
        
        if len(leads) > 0:
            lead_id = leads[0].get("id")
            response = requests.get(f"{BASE_URL}/api/leads/{lead_id}")
            assert response.status_code == 200
            data = response.json()
            assert data.get("id") == lead_id
            print(f"SUCCESS: GET /api/leads/{lead_id} returned lead data")
        else:
            pytest.skip("No leads available to test")
    
    def test_get_lead_not_found(self):
        """Test GET /api/leads/:id returns 404 for non-existent lead"""
        response = requests.get(f"{BASE_URL}/api/leads/nonexistent123")
        assert response.status_code == 404
        print("SUCCESS: GET /api/leads/nonexistent returns 404")
    
    def test_post_leads_validation(self):
        """Test POST /api/leads validates required fields"""
        response = requests.post(f"{BASE_URL}/api/leads", json={
            "fullName": "Test Lead"
            # Missing required fields
        })
        # Should return 400 for missing fields or 500 if storage quota exceeded
        assert response.status_code in [400, 500]
        print(f"SUCCESS: POST /api/leads validation returned {response.status_code}")


class TestAgentsAPI:
    """Agents API endpoint tests"""
    
    def test_get_agents_list(self):
        """Test GET /api/agents returns list of agents"""
        response = requests.get(f"{BASE_URL}/api/agents")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"SUCCESS: GET /api/agents returned {len(data)} agents")
        
        # Verify agent structure
        if len(data) > 0:
            agent = data[0]
            assert "id" in agent
            assert "firstName" in agent
            assert "lastName" in agent
            assert "email" in agent
            print("SUCCESS: Agent data structure is correct")
    
    def test_get_agent_by_id(self):
        """Test GET /api/agents/:id returns a specific agent"""
        # First get list to find an existing agent
        list_response = requests.get(f"{BASE_URL}/api/agents")
        agents = list_response.json()
        
        if len(agents) > 0:
            agent_id = agents[0].get("id")
            response = requests.get(f"{BASE_URL}/api/agents/{agent_id}")
            assert response.status_code == 200
            data = response.json()
            assert data.get("id") == agent_id
            print(f"SUCCESS: GET /api/agents/{agent_id} returned agent data")
        else:
            pytest.skip("No agents available to test")
    
    def test_get_agent_invalid_id(self):
        """Test GET /api/agents/:id returns 400 for invalid ID format"""
        response = requests.get(f"{BASE_URL}/api/agents/invalid")
        assert response.status_code == 400
        print("SUCCESS: GET /api/agents/invalid returns 400")


class TestClaimAPI:
    """Lead claim API endpoint tests"""
    
    def test_claim_verify_invalid_token(self):
        """Test GET /api/leads/claim/:token with invalid token"""
        response = requests.get(f"{BASE_URL}/api/leads/claim/invalid-token-123")
        assert response.status_code == 200
        data = response.json()
        assert data.get("valid") == False
        assert "message" in data
        print("SUCCESS: Claim verify returns invalid for bad token")
    
    def test_claim_execute_invalid_token(self):
        """Test POST /api/leads/claim/:token with invalid token"""
        response = requests.post(f"{BASE_URL}/api/leads/claim/invalid-token-123")
        assert response.status_code == 200
        data = response.json()
        assert data.get("success") == False
        assert "message" in data
        print("SUCCESS: Claim execute returns failure for bad token")


class TestLeadActivityAPI:
    """Lead activity API endpoint tests"""
    
    def test_get_activity_logs(self):
        """Test GET /api/leads/activity returns activity logs"""
        response = requests.get(f"{BASE_URL}/api/leads/activity")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"SUCCESS: GET /api/leads/activity returned {len(data)} logs")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
